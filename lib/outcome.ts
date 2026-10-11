export function toolOutcome(data:unknown){const d=data as {partial?:boolean;scenario?:string}|null;return d?.partial?'partial':d?.scenario==='flaky'?'recovered':'ok';}
