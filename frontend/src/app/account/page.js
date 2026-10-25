import {redirect} from 'next/navigation';
export const metadata={title:'Your account',robots:{index:false,follow:false}};
export default function Account(){redirect('/dashboard');}
