import './globals.css';
import './theme.css';
export const metadata={title:'AllToolNexa Admin',description:'Manage the AllToolNexa catalog and review application health.',icons:{icon:'/images/alltoolnexa-logo.png'},robots:{index:false,follow:false}};
export default function RootLayout({children}){return <html lang="en" suppressHydrationWarning><body><a href="#admin-main" className="admin-skip-link">Skip to content</a>{children}</body></html>;}
