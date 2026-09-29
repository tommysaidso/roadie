import { CA_REGIONS } from "./ca";
import { US_REGIONS } from "./us";
// Registry — each region is its own config block (a "province folder" pattern).
// Future: split into per-province files + a manager/MCP each; laws & booking differ per region.
export const REGIONS = {
  CA: { name:"Canada", pro:"SOCAN", regions: CA_REGIONS },
  US: { name:"United States", pro:"ASCAP / BMI", regions: US_REGIONS },
};
export function regionList(){
  return [...CA_REGIONS.map(r=>({...r,country:"CA"})), ...US_REGIONS.map(r=>({...r,country:"US"}))];
}
