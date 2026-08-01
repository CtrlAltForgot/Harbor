import { constants } from "node:fs";
import { access, cp, mkdir, rename, rm, stat, statfs, readdir } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Classification } from "@harbor/contracts";

export interface OrganizationResult { source:string; destination:string; bytes:number; method:"copy" }

export async function validateDestination(target:string){await mkdir(target,{recursive:true});await access(target,constants.R_OK|constants.W_OK);const details=await stat(target);if(!details.isDirectory())throw new Error(`Destination is not a directory: ${target}`);}

export async function organize(source:string,destinationRoot:string,classification:Classification):Promise<OrganizationResult>{
  await validateDestination(destinationRoot);const sourceInfo=await stat(source);if(!sourceInfo.isFile()&&!sourceInfo.isDirectory())throw new Error("Downloaded content is not a regular file or directory");
  const relative=buildRelativeName(source,classification);const destination=path.join(destinationRoot,relative);assertInside(destinationRoot,destination);
  try{await stat(destination);throw new Error(`Organization destination already exists: ${destination}`);}catch(error){if((error as NodeJS.ErrnoException).code!=="ENOENT")throw error;}
  const temporary=`${destination}.harbor-${randomUUID()}.partial`;await mkdir(path.dirname(destination),{recursive:true});const sourceBytes=await treeSize(source);const filesystem=await statfs(destinationRoot);const available=Number(filesystem.bavail)*Number(filesystem.bsize);if(available<sourceBytes+64*1024*1024)throw new Error(`Insufficient destination space: need ${sourceBytes} bytes, have ${available}`);
  try{await cp(source,temporary,{recursive:true,errorOnExist:true,preserveTimestamps:true});const targetBytes=await treeSize(temporary);if(sourceBytes!==targetBytes)throw new Error(`Copy verification failed: expected ${sourceBytes} bytes, found ${targetBytes}`);await rename(temporary,destination);return{source,destination,bytes:targetBytes,method:"copy"};}catch(error){await rm(temporary,{recursive:true,force:true});throw error;}
}

export function buildRelativeName(source:string,classification:Classification){const sourceName=path.basename(source);const extension=path.extname(sourceName);const safeTitle=sanitize(classification.title)||"Untitled";if(classification.category==="movie")return extension?path.join(safeTitle,`${safeTitle}${extension.toLowerCase()}`):safeTitle;if(classification.category==="tv"){const season=classification.season??0;const seasonFolder=`Season ${String(season).padStart(2,"0")}`;if(extension&&classification.episode!==undefined)return path.join(safeTitle,seasonFolder,`${safeTitle} - S${String(season).padStart(2,"0")}E${String(classification.episode).padStart(2,"0")}${extension.toLowerCase()}`);return path.join(safeTitle,seasonFolder);}return safeTitle;}
function sanitize(value:string){return value.replace(/[\\/:*?"<>|\u0000-\u001f]/g," ").replace(/\s+/g," ").trim().replace(/[. ]+$/g,"");}
function assertInside(root:string,target:string){const relative=path.relative(path.resolve(root),path.resolve(target));if(relative.startsWith("..")||path.isAbsolute(relative))throw new Error("Organization target escapes its configured destination");}
async function treeSize(target:string):Promise<number>{const details=await stat(target);if(details.isFile())return details.size;let total=0;for(const entry of await readdir(target))total+=await treeSize(path.join(target,entry));return total;}
