import Vue, { VueConstructor } from 'vue';
import { api } from '@/services/rotkehlchen-api';
import Chart from 'chart.js';
import moment from 'moment';

export const setupPremium = () => {
  window.Vue = Vue;
  window.Chart = Chart;
  window.moment = moment;
};

function findComponents(): string[] {
  return Object.getOwnPropertyNames(window).filter(value =>
    value.startsWith('PremiumComponents')
  );
}

async function loadComponents(): Promise<string[]> {
  return new Promise(async (resolve, reject) => {
    let components = findComponents();
    if (components.length > 0) {
      resolve(components);
      return;
    }

    const result = await api.queryStatisticsRenderer();
    const script = document.createElement('script');
    script.text = result;
    document.head.appendChild(script);

    components = findComponents();

    if (components.length === 0) {
      reject(new Error('There was no component loaded'));
      return;
    }

    script.addEventListener('error', reject);
    resolve(components);
  });
}

async function loadLibrary() {
  const [component] = await loadComponents();
  // @ts-ignore
  const library = window[component];
  if (!library.installed) {
    Vue.use(library.install);
    library.installed = true;
  }
  return library;
}

export const PremiumStatistics = (): Promise<VueConstructor> => {
  return new Promise(async resolve =>
    resolve((await loadLibrary()).PremiumStatistics)
  );
};

export const DsrMovementHistory = (): Promise<VueConstructor> => {
  return new Promise(async resolve =>
    resolve((await loadLibrary()).DsrMovementHistory)
  );
};

declare global {
  interface Window {
    Vue: typeof Vue;
    Chart: typeof Chart;
    moment: typeof moment;
  }
}
