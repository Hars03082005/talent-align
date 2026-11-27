import maturityMap from '../../../config/gartner_maturity_map.json';

export const maturityStages = maturityMap.stages;
const shortNames = ['Trigger', 'Peak', 'Trough', 'Slope', 'Plateau'];

export function MaturityStages({ stage }: { stage: string }) {
  return <ol className="maturity-stages" aria-label="Gartner Hype Cycle stages">
    {maturityStages.map((name, index) => <li key={name} aria-current={name === stage ? 'step' : undefined} title={name}><span aria-hidden="true"/>{shortNames[index]}</li>)}
  </ol>;
}
