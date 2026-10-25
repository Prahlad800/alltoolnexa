import AuthPanel from '@/components/AuthPanel';
export const metadata={title:'User login',description:'Sign in to your AllToolNexa user account.',alternates:{canonical:'/login'},robots:{index:false,follow:false}};
export default function Login(){return <div className="container page-space auth-page"><AuthPanel/></div>;}
