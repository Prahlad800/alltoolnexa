import {processBrowserTool} from './browser-tools.js';
// Image processors use the same small canvas API in a worker and on the main thread.
self.document={createElement(name){if(name!=='canvas')throw Error('Unsupported worker element.');const c=new OffscreenCanvas(1,1);c.toBlob=(callback,type,quality)=>c.convertToBlob({type,quality}).then(callback,()=>callback(null));return c;}};
self.onmessage=async({data})=>{try{self.postMessage({result:await processBrowserTool(data.tool,data.values,data.files,{onProgress:progress=>self.postMessage({progress})})});}catch(e){self.postMessage({error:e.message});}};
