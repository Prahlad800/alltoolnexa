import AuthPanel from '@/components/AuthPanel';
export const metadata={title:'Create your account',description:'Create an AllToolNexa user account. Browser tools remain free without an account.',alternates:{canonical:'/signup'},robots:{index:false,follow:false}};
export default function Signup(){return <div className="container page-space auth-page"><AuthPanel mode="signup"/></div>;}
