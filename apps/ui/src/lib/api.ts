import type { AddTorrentRequest, ServerStatus, Torrent } from "@harbor/contracts";
const KEY="harbor.connection";
export interface Connection { baseUrl:string; token:string; serverName:string }
export const connection={ get():Connection|null{try{return JSON.parse(localStorage.getItem(KEY)||"null")}catch{return null}}, set(value:Connection){localStorage.setItem(KEY,JSON.stringify(value))}, clear(){localStorage.removeItem(KEY)} };
async function request<T>(path:string,init:RequestInit={}){const saved=connection.get();if(!saved)throw new Error("Pair with your server first");const response=await fetch(`${saved.baseUrl}${path}`,{...init,headers:{"content-type":"application/json",authorization:`Bearer ${saved.token}`,...init.headers}});if(!response.ok){const body=await response.json().catch(()=>({}));throw new Error(body.error||`Request failed (${response.status})`)}return response.status===204?undefined as T:response.json()}
export const api={
  async pair(baseUrl:string,code:string){const clean=baseUrl.replace(/\/$/,"");const response=await fetch(`${clean}/api/v1/pair`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({code,label:"Harbor Desktop"})});const body=await response.json();if(!response.ok)throw new Error(body.error||"Pairing failed");connection.set({baseUrl:clean,token:body.token,serverName:body.serverName});return body},
  status:()=>request<ServerStatus>("/api/v1/status"), list:()=>request<Torrent[]>("/api/v1/torrents"), add:(input:AddTorrentRequest)=>request<Torrent>("/api/v1/torrents",{method:"POST",body:JSON.stringify(input)}), action:(id:string,action:string)=>request<Torrent>(`/api/v1/torrents/${id}/${action}`,{method:"POST"}), remove:(id:string)=>request<void>(`/api/v1/torrents/${id}`,{method:"DELETE"})
};
