import { getRequest } from '@/utils/request';


// 查询无人机轨迹
export function getDroneTrack(params) {
  const { droneId, startTime, endTime } = params;
  return getRequest(`/drone/track/query?droneId=${droneId}&startTime=${startTime}&endTime=${endTime}`);
}