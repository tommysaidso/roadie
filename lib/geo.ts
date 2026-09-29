export function haversineKm(a:[number,number], b:[number,number]){
  const R=6371, toRad=(d:number)=>d*Math.PI/180;
  const dLat=toRad(b[0]-a[0]), dLng=toRad(b[1]-a[1]);
  const s=Math.sin(dLat/2)**2 + Math.cos(toRad(a[0]))*Math.cos(toRad(b[0]))*Math.sin(dLng/2)**2;
  return 2*R*Math.asin(Math.sqrt(s));
}
