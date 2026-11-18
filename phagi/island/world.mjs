export const boardSize=10;
export const tile=20;
export const position=b=>({x:(b.col+.5)*tile,y:(b.row+.5)*tile});
export const cellName=(col,row)=>'АБВГДЕЖЗИК'[col]+(row+1);
export function shorePositions(size=boardSize){
  const edge=size*tile;
  return [[edge*.08,edge-2],[edge*.5,edge-2],[edge*.92,edge-2]];
}
export const legacyRaidSize=5;
