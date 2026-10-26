CREATE OR REPLACE FUNCTION public.alltoolnexa_backend(operation text, arguments jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, alltoolnexa_private, pg_temp AS $$
DECLARE
 u users%ROWTYPE; s auth_sessions%ROWTYPE; v page_visits%ROWTYPE; f user_files%ROWTYPE; o billing_orders%ROWTYPE;
 result jsonb; n bigint; uid uuid; begin_at timestamptz; end_at timestamptz;
 quota bigint; max_file bigint; plan text; until_at timestamptz; payload bytea;
BEGIN
 IF (current_setting('request.jwt.claims',true)::jsonb->>'role') IS DISTINCT FROM 'service_role' THEN
  RAISE EXCEPTION 'Backend access only' USING ERRCODE='42501';
 END IF;
 CASE operation
 WHEN 'ping' THEN
  PERFORM id FROM users LIMIT 1;
  PERFORM key FROM site_controls LIMIT 1;
  PERFORM id FROM user_files LIMIT 1;
  PERFORM id FROM billing_orders LIMIT 1;
  RETURN jsonb_build_object('connected',true);
 WHEN 'user_find' THEN
  SELECT * INTO u FROM users WHERE CASE WHEN arguments->>'field'='username' THEN username=arguments->>'value' ELSE email=arguments->>'value' END;
  RETURN CASE WHEN u.id IS NULL THEN NULL ELSE to_jsonb(u) END;
 WHEN 'user_create' THEN
  INSERT INTO users(id,email,password_hash,role) VALUES ((arguments->>'id')::uuid,arguments->>'email',arguments->>'password_hash','user') RETURNING * INTO u;
  RETURN to_jsonb(u);
 WHEN 'session_issue' THEN
  DELETE FROM auth_sessions WHERE token_hash=arguments->>'old_digest';
  INSERT INTO auth_sessions(id,user_id,token_hash,created_at,expires_at) VALUES
   (gen_random_uuid(),(arguments->>'user_id')::uuid,arguments->>'digest',(arguments->>'created_at')::timestamptz,(arguments->>'expires_at')::timestamptz);
  RETURN '{}'::jsonb;
 WHEN 'session_current' THEN
  SELECT * INTO s FROM auth_sessions WHERE token_hash=arguments->>'digest' AND expires_at>now();
  SELECT * INTO u FROM users WHERE id=s.user_id AND is_active;
  RETURN CASE WHEN u.id IS NULL THEN NULL ELSE to_jsonb(u)-'password_hash' END;
 WHEN 'session_revoke' THEN
  DELETE FROM auth_sessions WHERE token_hash=arguments->>'digest'; RETURN '{}'::jsonb;
 WHEN 'controls' THEN
  SELECT jsonb_build_object('disabledTools',coalesce(jsonb_agg(substring(key from 6)) FILTER(WHERE key LIKE 'tool:%'),'[]'::jsonb),
   'disabledCategories',coalesce(jsonb_agg(substring(key from 10)) FILTER(WHERE key LIKE 'category:%'),'[]'::jsonb)) INTO result FROM site_controls WHERE NOT enabled;
  RETURN result;
 WHEN 'control_update' THEN
  INSERT INTO site_controls(key,enabled,updated_by,updated_at) VALUES(arguments->>'key',(arguments->>'enabled')::boolean,(arguments->>'admin')::uuid,now())
   ON CONFLICT(key) DO UPDATE SET enabled=excluded.enabled,updated_by=excluded.updated_by,updated_at=now(); RETURN '{}'::jsonb;
 WHEN 'cleanup' THEN
  DELETE FROM page_visits WHERE deleted_at<=now()-interval '30 days'; GET DIAGNOSTICS n=ROW_COUNT;
  UPDATE page_visits SET deleted_at=now() WHERE deleted_at IS NULL AND coalesce(restored_at,started_at)<now()-interval '30 days';
  RETURN jsonb_build_object('purged',n);
 WHEN 'visit_start' THEN
  INSERT INTO page_visits(id,visitor_hash,user_id,path,ip_address,device,referrer_host,active_seconds,started_at,last_seen_at,country,region,city,location_status)
   VALUES(gen_random_uuid(),arguments->>'visitor_hash',nullif(arguments->>'user_id','')::uuid,arguments->>'path',arguments->>'ip_address',arguments->>'device',
    arguments->>'referrer_host',0,now(),now(),arguments->>'country',arguments->>'region',arguments->>'city',arguments->>'location_status') RETURNING * INTO v;
  RETURN jsonb_build_object('id',v.id);
 WHEN 'heartbeat' THEN
  SELECT * INTO v FROM page_visits WHERE id=(arguments->>'id')::uuid AND deleted_at IS NULL AND visitor_hash=arguments->>'digest' FOR UPDATE;
  IF v.id IS NULL THEN RETURN jsonb_build_object('error','Visit not found.','status',404); END IF;
  UPDATE page_visits SET active_seconds=greatest(active_seconds,least((arguments->>'seconds')::int,greatest(0,floor(extract(epoch from now()-started_at))::int)+2)),last_seen_at=now() WHERE id=v.id;
  RETURN '{}'::jsonb;
 WHEN 'analytics' THEN
  begin_at=now()-make_interval(days=>(arguments->>'days')::int);
  WITH selected AS (SELECT * FROM page_visits WHERE deleted_at IS NULL AND started_at>=begin_at AND (coalesce(arguments->>'visitor','')='' OR visitor_hash=arguments->>'visitor')),
  pages AS (SELECT path,count(*) views,sum(active_seconds) seconds FROM selected GROUP BY path ORDER BY count(*) DESC LIMIT 30),
  visits AS (SELECT pv.*,au.email FROM selected pv LEFT JOIN users au ON au.id=pv.user_id ORDER BY pv.started_at DESC OFFSET ((arguments->>'page')::int-1)*50 LIMIT 50)
  SELECT jsonb_build_object('summary',(SELECT jsonb_build_object('pageViews',count(*),'visitors',count(DISTINCT visitor_hash),'activeSeconds',coalesce(sum(active_seconds),0),'signedInVisitors',count(DISTINCT visitor_hash) FILTER(WHERE user_id IS NOT NULL)) FROM selected),
   'pages',(SELECT coalesce(jsonb_agg(jsonb_build_object('path',path,'views',views,'activeSeconds',seconds)),'[]'::jsonb) FROM pages),
   'visits',(SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'visitorId',visitor_hash,'email',email,'path',path,'ip',ip_address,'country',country,'region',region,'city',city,'locationStatus',location_status,'device',device,'activeSeconds',active_seconds,'startedAt',started_at,'lastSeenAt',last_seen_at)),'[]'::jsonb) FROM visits),
   'pagination',jsonb_build_object('page',(arguments->>'page')::int,'hasMore',(arguments->>'page')::int*50<(SELECT count(*) FROM selected)),'retentionDays',30) INTO result;
  RETURN result;
 WHEN 'delete_preview','visits_delete' THEN
  begin_at=(arguments->>'begin')::timestamptz; end_at=(arguments->>'end')::timestamptz;
  IF operation='delete_preview' THEN
   SELECT count(*) INTO n FROM page_visits WHERE deleted_at IS NULL AND started_at BETWEEN begin_at AND end_at AND (coalesce(arguments->>'visitor','')='' OR visitor_hash=arguments->>'visitor');
  ELSE
   UPDATE page_visits SET deleted_at=now() WHERE deleted_at IS NULL AND started_at BETWEEN begin_at AND end_at AND (coalesce(arguments->>'visitor','')='' OR visitor_hash=arguments->>'visitor'); GET DIAGNOSTICS n=ROW_COUNT;
  END IF;
  RETURN jsonb_build_object('count',n);
 WHEN 'trash' THEN
  SELECT count(*) INTO n FROM page_visits WHERE deleted_at>now()-interval '30 days';
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'path',path,'visitorId',visitor_hash,'deletedAt',deleted_at,'expiresAt',deleted_at+interval '30 days')),'[]'::jsonb) INTO result
   FROM (SELECT * FROM page_visits WHERE deleted_at>now()-interval '30 days' ORDER BY deleted_at DESC,id OFFSET ((arguments->>'page')::int-1)*50 LIMIT 50) t;
  RETURN jsonb_build_object('count',n,'visits',result,'pagination',jsonb_build_object('page',(arguments->>'page')::int,'hasMore',(arguments->>'page')::int*50<n));
 WHEN 'restore' THEN
  UPDATE page_visits SET deleted_at=NULL,restored_at=now() WHERE id=(arguments->>'id')::uuid AND deleted_at>now()-interval '30 days'; GET DIAGNOSTICS n=ROW_COUNT;
  RETURN jsonb_build_object('count',n);
 WHEN 'entitlement' THEN
  SELECT * INTO o FROM billing_orders WHERE user_id=(arguments->>'user_id')::uuid AND paid_until>now() ORDER BY created_at DESC LIMIT 1;
  RETURN jsonb_build_object('plan',coalesce(o.plan_id,'free'));
 WHEN 'storage_list' THEN
  uid=(arguments->>'user_id')::uuid;
  SELECT count(*) INTO n FROM user_files WHERE user_id=uid;
  SELECT coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'sizeBytes',size_bytes,'createdAt',created_at)),'[]'::jsonb) INTO result
   FROM (SELECT id,name,size_bytes,created_at FROM user_files WHERE user_id=uid ORDER BY created_at DESC,id OFFSET ((arguments->>'page')::int-1)*25 LIMIT 25)t;
  RETURN jsonb_build_object('files',result,'fileCount',n,'usedBytes',(SELECT coalesce(sum(size_bytes),0) FROM user_files WHERE user_id=uid),'pagination',jsonb_build_object('page',(arguments->>'page')::int,'hasMore',(arguments->>'page')::int*25<n));
 WHEN 'storage_upload' THEN
  uid=(arguments->>'user_id')::uuid; PERFORM id FROM users WHERE id=uid FOR UPDATE;
  SELECT plan_id INTO plan FROM billing_orders WHERE user_id=uid AND paid_until>now() ORDER BY created_at DESC LIMIT 1;
  quota=CASE plan WHEN 'basic' THEN 200000000 WHEN 'pro' THEN 1000000000 WHEN 'premium' THEN 5000000000 WHEN 'premium-plus' THEN 10000000000 ELSE 50000000 END;
  max_file=CASE plan WHEN 'basic' THEN 20000000 WHEN 'pro' THEN 100000000 WHEN 'premium' THEN 500000000 WHEN 'premium-plus' THEN 1000000000 ELSE 2000000 END;
  payload=decode(arguments->>'content','base64');
  IF octet_length(payload)=0 OR octet_length(payload)>max_file THEN RETURN jsonb_build_object('error','File exceeds your plan limit.','status',413); END IF;
  IF (SELECT coalesce(sum(size_bytes),0) FROM user_files WHERE user_id=uid)+octet_length(payload)>quota THEN RETURN jsonb_build_object('error','Your storage is full.','status',409); END IF;
  INSERT INTO user_files(id,user_id,name,size_bytes,content) VALUES(gen_random_uuid(),uid,arguments->>'name',octet_length(payload),payload) RETURNING id INTO uid;
  RETURN jsonb_build_object('id',uid);
 WHEN 'storage_download' THEN
  SELECT * INTO f FROM user_files WHERE id=(arguments->>'id')::uuid AND user_id=(arguments->>'user_id')::uuid;
  RETURN CASE WHEN f.id IS NULL THEN NULL ELSE jsonb_build_object('name',f.name,'content',encode(f.content,'base64')) END;
 WHEN 'storage_delete' THEN
  uid=(arguments->>'user_id')::uuid; PERFORM id FROM users WHERE id=uid FOR UPDATE;
  DELETE FROM user_files WHERE id=(arguments->>'id')::uuid AND user_id=uid; GET DIAGNOSTICS n=ROW_COUNT; RETURN jsonb_build_object('count',n);
 WHEN 'orders' THEN
  SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) INTO result FROM (SELECT * FROM billing_orders ORDER BY created_at DESC LIMIT 100)t; RETURN result;
 WHEN 'order_create' THEN
  INSERT INTO billing_orders(id,user_id,plan_id,amount) VALUES(arguments->>'id',(arguments->>'user_id')::uuid,arguments->>'plan_id',(arguments->>'amount')::int); RETURN '{}'::jsonb;
 WHEN 'order_get' THEN
  SELECT * INTO o FROM billing_orders WHERE id=arguments->>'id'; RETURN CASE WHEN o.id IS NULL THEN NULL ELSE to_jsonb(o) END;
 WHEN 'order_activate' THEN
  SELECT * INTO o FROM billing_orders WHERE id=arguments->>'id';
  IF o.id IS NULL THEN RETURN jsonb_build_object('error','Order not found.','status',404); END IF;
  PERFORM id FROM users WHERE id=o.user_id FOR UPDATE;
  SELECT * INTO o FROM billing_orders WHERE id=arguments->>'id';
  IF o.payment_id IS NOT NULL THEN
   IF o.payment_id<>arguments->>'payment_id' THEN RETURN jsonb_build_object('error','Order already settled.','status',409); END IF;
   RETURN jsonb_build_object('plan',o.plan_id,'paidUntil',o.paid_until);
  END IF;
  SELECT greatest(now(),coalesce(max(paid_until),now())) INTO until_at FROM billing_orders WHERE user_id=o.user_id AND plan_id=o.plan_id;
  UPDATE billing_orders SET payment_id=arguments->>'payment_id',paid_until=until_at+interval '1 month' WHERE id=o.id RETURNING * INTO o;
  RETURN jsonb_build_object('plan',o.plan_id,'paidUntil',o.paid_until);
 ELSE RAISE EXCEPTION 'Unknown backend operation' USING ERRCODE='22023';
 END CASE;
END;
$$;
REVOKE ALL ON FUNCTION public.alltoolnexa_backend(text,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.alltoolnexa_backend(text,jsonb) TO service_role;
NOTIFY pgrst, 'reload schema';
