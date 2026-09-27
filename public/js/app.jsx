import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {usePublic} from './shared.jsx';
import {Header,Footer,Home,PublicPage} from './site.jsx';
import {Portal} from './portal.jsx';
import {Director} from './director.jsx';
function WelcomeScreen(){return <main className="school-opening" aria-label="Welcome to Blessed Vines preparatory school"><div className="school-opening-content"><img src="/images/blessed-vines-opening-logo.jpeg" alt="Blessed Vines School logo" className="school-opening-logo" fetchPriority="high"/><h1>Blessed Vines preparatory school.</h1><div className="school-opening-progress" aria-hidden="true"><span/></div><p role="status">Welcome. Your school journey begins here.</p></div></main>}
function App(){const [opening,setOpening]=useState(()=>location.pathname==='/');useEffect(()=>{if(!opening)return;const timer=setTimeout(()=>setOpening(false),5000);return()=>clearTimeout(timer);},[opening]);const {data,error}=usePublic();const page=location.pathname.replace(/\/$/,'')||'/';if(opening)return <WelcomeScreen/>;if(page==='/director-portal')return <Director/>;if(page==='/parent-portal'||page==='/staff-portal')return <Portal initialStaff={page==='/staff-portal'}/>;if(error)return <main className="loading"><h1>We couldn’t open the school website.</h1><p>{error}</p><button className="btn primary" onClick={()=>location.reload()}>Try again</button></main>;if(!data)return <main className="loading">A bright beginning is loading…</main>;return <><a className="skip-link" href="#main">Skip to content</a><Header school={data.school}/><main id="main">{page==='/'?<Home data={data}/>:<PublicPage page={page} data={data}/>}</main><Footer school={data.school}/></>}
class ErrorBoundary extends React.Component{state={error:false};static getDerivedStateFromError(){return {error:true};}render(){return this.state.error?<main className="loading"><h1>Something went wrong.</h1><a href="/">Return to the school website</a></main>:this.props.children;}}
createRoot(document.getElementById('root')).render(<ErrorBoundary><App/></ErrorBoundary>);
if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js').catch(()=>{});
