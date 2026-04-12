import { DoctorResult } from "../lib/tauri";

export interface HermesSlice {
  isInstalled: boolean;
  version: string | null;
  doctorResults: DoctorResult[];
  doctorRunning: boolean;
  setInstalled: (installed: boolean, version: string | null) => void;
  setDoctorResults: (results: DoctorResult[]) => void;
  setDoctorRunning: (running: boolean) => void;
}

export const createHermesSlice = (set: (fn: (s: HermesSlice) => Partial<HermesSlice>) => void): HermesSlice => ({
  isInstalled: false,
  version: null,
  doctorResults: [],
  doctorRunning: false,
  setInstalled: (installed, version) => set(() => ({ isInstalled: installed, version })),
  setDoctorResults: (results) => set(() => ({ doctorResults: results })),
  setDoctorRunning: (running) => set(() => ({ doctorRunning: running })),
});
