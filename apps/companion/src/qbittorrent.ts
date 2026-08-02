import type { Torrent, TorrentFile } from "@harbor/contracts";
import type { Config } from "./config.js";

export type QbitTorrent = { hash:string; name:string; state:string; progress:number; dlspeed:number; upspeed:number; eta:number; num_seeds:number; num_leechs:number; total_size:number; downloaded:number; save_path:string; content_path:string; added_on:number; completion_on:number };
type QbitFile = { index:number; name:string; size:number; progress:number; priority:number };
type QbitTransferInfo = { connection_status?:string; use_alt_speed_limits?:boolean; free_space_on_disk?:number };
export type QbitLog = { id:number; timestamp:number; type:number; message:string };

export class QbitClient {
  private cookie = "";
  constructor(private config: Config) {}
  async health(){ await this.call("/api/v2/app/version"); }
  async addMagnet(magnet:string, _category:string, expectedHash?:string){const form=new FormData();form.set("urls",magnet);form.set("savepath",this.config.incompleteDir);await this.expectAccepted("/api/v2/torrents/add",form);if(expectedHash)await this.waitUntilPresent(expectedHash);}
  async addFile(data:Buffer,fileName:string,_category:string,expectedHash?:string){const form=new FormData();form.set("torrents",new Blob([new Uint8Array(data)]),fileName);form.set("savepath",this.config.incompleteDir);await this.expectAccepted("/api/v2/torrents/add",form);if(expectedHash)await this.waitUntilPresent(expectedHash);}
  async list(){return this.callJson<QbitTorrent[]>("/api/v2/torrents/info");}
  async preferences(){return this.callJson<Record<string,unknown>>("/api/v2/app/preferences");}
  async setPreferences(values:Record<string,unknown>){await this.post("/api/v2/app/setPreferences",{json:JSON.stringify(values)});}
  async engineInfo(){
    const [version,webApiVersion,transfer,recentLogs]=await Promise.all([
      this.callText("/api/v2/app/version"),
      this.callText("/api/v2/app/webapiVersion"),
      this.callJson<QbitTransferInfo>("/api/v2/transfer/info"),
      this.callJson<QbitLog[]>("/api/v2/log/main?normal=true&info=true&warning=true&critical=true&last_known_id=-1"),
    ]);
    return {version,webApiVersion,connectionStatus:transfer.connection_status??"unknown",alternativeSpeedLimits:Boolean(transfer.use_alt_speed_limits),freeSpace:Number(transfer.free_space_on_disk??-1),recentLogs:recentLogs.slice(-100)};
  }
  async toggleAlternativeSpeedLimits(){await this.post("/api/v2/transfer/toggleSpeedLimitsMode",{});return this.engineInfo();}
  async files(hash:string){return this.callJson<QbitFile[]>(`/api/v2/torrents/files?hash=${encodeURIComponent(hash)}`);}
  async action(hash:string,action:"pause"|"resume"|"recheck"){
    const modern=action==="pause"?"stop":action==="resume"?"start":"recheck";
    try{await this.post(`/api/v2/torrents/${modern}`,{hashes:hash});}
    catch(error){if(action==="recheck")throw error;await this.post(`/api/v2/torrents/${action}`,{hashes:hash});}
    if(action!=="recheck")await this.verifyState(hash,action);
  }
  async remove(hash:string,deleteFiles=false){await this.post("/api/v2/torrents/delete",{hashes:hash,deleteFiles:String(deleteFiles)});for(let attempt=0;attempt<12;attempt++){if(!(await this.list()).some(item=>item.hash.toLowerCase()===hash.toLowerCase()))return;await delay(125);}throw new Error("qBittorrent did not confirm torrent removal");}
  async setFilePriority(hash:string,ids:number[],priority:number){await this.post("/api/v2/torrents/filePrio",{hash,ids:ids.join("|"),priority:String(priority)});}
  async setLimits(hash:string,download:number,upload:number){await this.post("/api/v2/torrents/setDownloadLimit",{hashes:hash,limit:String(download)});await this.post("/api/v2/torrents/setUploadLimit",{hashes:hash,limit:String(upload)});}
  async command(hash:string,action:"reannounce"|"increasePrio"|"decreasePrio"|"topPrio"|"bottomPrio"){await this.post(`/api/v2/torrents/${action}`,{hashes:hash});}
  async sync(record:Torrent, remote:QbitTorrent):Promise<Torrent>{let files:TorrentFile[]=record.files;try{files=(await this.files(remote.hash)).map(f=>({id:f.index,name:f.name,size:f.size,progress:f.progress,priority:f.priority}));}catch{}const status=mapState(remote.state,record);return{...record,infoHash:remote.hash.toLowerCase(),name:remote.name||record.name,status,progress:remote.progress,downloadSpeed:remote.dlspeed,uploadSpeed:remote.upspeed,etaSeconds:remote.eta>=8640000?null:remote.eta,seeds:remote.num_seeds,peers:remote.num_leechs,size:remote.total_size,downloaded:remote.downloaded,files,completedAt:remote.completion_on>0?new Date(remote.completion_on*1000).toISOString():record.completedAt};}
  private async post(path:string,values:Record<string,string>){const body=new URLSearchParams(values);await this.call(path,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded"},body});}
  private async expectAccepted(path:string,body:FormData){const response=await this.call(path,{method:"POST",body});if((await response.text()).trim()==="Fails.")throw new Error("qBittorrent rejected the torrent");}
  private async login(){const body=new URLSearchParams({username:this.config.qbitUsername,password:this.config.qbitPassword});const response=await fetch(`${this.config.qbitUrl}/api/v2/auth/login`,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded","referer":this.config.qbitUrl},body});const responseText=await response.text();this.cookie=response.headers.getSetCookie().map(v=>v.split(";",1)[0]).join("; ");if(!response.ok||!this.cookie||(responseText.trim()&&responseText.trim()!=="Ok."))throw new Error(`qBittorrent authentication failed (${response.status})`);}
  private async call(path:string,init:RequestInit={},retry=true):Promise<Response>{if(!this.cookie)await this.login();const response=await fetch(`${this.config.qbitUrl}${path}`,{...init,headers:{referer:this.config.qbitUrl,cookie:this.cookie,...init.headers}});if(response.status===403&&retry){this.cookie="";await this.login();return this.call(path,init,false);}if(!response.ok)throw new Error(`qBittorrent request failed (${response.status})`);return response;}
  private async callJson<T>(path:string){return (await this.call(path)).json() as Promise<T>;}
  private async callText(path:string){return (await this.call(path)).text();}
  private async waitUntilPresent(hash:string){for(let attempt=0;attempt<20;attempt++){if((await this.list()).some(item=>item.hash.toLowerCase()===hash.toLowerCase()))return;await delay(150);}throw new Error("qBittorrent accepted the request but the torrent never appeared");}
  private async verifyState(hash:string,action:"pause"|"resume"){for(let attempt=0;attempt<12;attempt++){const torrent=(await this.list()).find(item=>item.hash.toLowerCase()===hash.toLowerCase());if(!torrent)throw new Error("Torrent is no longer present in qBittorrent");const stopped=/^(?:paused|stopped)/i.test(torrent.state);if((action==="pause"&&stopped)||(action==="resume"&&!stopped))return;await delay(125);}throw new Error(`qBittorrent did not confirm torrent ${action}`);}
}

const delay=(milliseconds:number)=>new Promise(resolve=>setTimeout(resolve,milliseconds));

function mapState(state:string,record:Torrent):Torrent["status"]{if(record.status==="organized"||record.status==="review")return record.status;if(state==="error"||state==="missingFiles")return"failed";if(state.startsWith("paused")||state.startsWith("stopped"))return record.progress>=1?"completed":"paused";if(state.includes("UP")||state==="uploading"||state==="stalledUP")return record.classification.confidence<.6?"review":"completed";if(state==="queuedDL"||state==="metaDL")return"queued";return"downloading";}
