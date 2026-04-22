import type { ProviderTestStatus } from './aiProviderClient';

export type StatusColor = 'grey' | 'yellow' | 'green' | 'red';

export function computeStatusColor(hasKey: boolean, testStatus: ProviderTestStatus): StatusColor {
	if (!hasKey) return 'grey';
	if (testStatus === 'untested') return 'yellow';
	if (testStatus === 'passed') return 'green';
	return 'red';
}
