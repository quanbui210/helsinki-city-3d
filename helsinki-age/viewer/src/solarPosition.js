import SunCalc from 'suncalc';
export function solarNoonPosition(year,month,position){
 const date=new Date(Date.UTC(year,month-1,15,12)),time=SunCalc.getTimes(date,position[1],position[0]).solarNoon;
 const sun=SunCalc.getPosition(time,position[1],position[0]);
 // SunCalc 1.9: radians, azimuth measured south towards west (not newer v2).
 const c=Math.cos(sun.altitude);
 return {time,altitude:sun.altitude,azimuth:sun.azimuth,direction:[-Math.sin(sun.azimuth)*c,-Math.cos(sun.azimuth)*c,Math.sin(sun.altitude)]};
}
