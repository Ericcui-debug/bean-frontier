import {inflateSync,strFromU8} from 'fflate';
self.onmessage=({data})=>{try{self.postMessage({navigation:JSON.parse(strFromU8(inflateSync(data.compressed)))});}catch(error){self.postMessage({error:error.message});}};
