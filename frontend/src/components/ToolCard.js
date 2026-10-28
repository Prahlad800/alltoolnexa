import {T} from '@/components/LanguageProvider';
import ToolIcon from './ToolIcon';
import Link from '@/components/ManagedLink';
export default function ToolCard({tool,category}) {return <Link href={`/tools/${tool.id}`} className="tool-card"><div className="card-top"><ToolIcon tool={tool}/><span className="card-arrow" aria-hidden="true">↗</span></div><h3>{<T label>{tool.name}</T>}</h3><p>{<T>{tool.description}</T>}</p><span className="card-category">{category?.name || tool.category}</span></Link>;}
