import type {
  FullResult, Reporter, TestCase, TestResult
} from '@playwright/test/reporter';

import fs from 'fs';
import { title } from 'process';

export default class MarkdownReporter implements Reporter {
  failures: (TestResult & { title: string })[] = [];

  onTestEnd(test: TestCase, result: TestResult) {
    if (result.status === 'failed') {
      this.failures.push({ ...result, title: test.title });
    }
  }

  onEnd(_: FullResult) {
    const alreadyReported: string[] = []
    const screenshotMatches = this.failures.map((test) => {
      return test.errors
        //@ts-expect-error the Playwright types are not up to date
        .map(({ matcherResult, location }) => ({
          pass: matcherResult?.pass,
          expected: matcherResult?.expected,
          actual: matcherResult?.actual,
          title: test.title,
          location,
        }))
        .filter(({ pass }) => !pass);
      }).flat().reduce((acc, { expected, actual, location, title }) => {
          const testName = `${title} ${location?.file}:${location?.line}`;
          if (alreadyReported.includes(testName)) {
            return acc;
          }

          alreadyReported.push(testName);

          const { file, line } = location ?? { file: 'unknown', line: 0 };
          return `${acc}
### ${title}
#### \`${file}:${line}\`
<table>
  <tr>
    <th>Expected</th>
    <th>Actual</th>
    <th>Diff</th>
  </tr>
  <tr>
    <td>
      <a href="${expected}" <img src="${expected}" alt="Expected" width="200" /></a>
    </td>
    <td>
      <a href="${actual}" <img src="${actual}" alt="Actual" width="200" /></a>
    </td>
    <td>
      <a href="${actual}" <img src="${actual}" alt="Diff" width="200" /></a>
    </td>
  </tr>
</table>
`
      }, '');

    console.log('Failing tests:', this.failures.map((test) => test.title), 'writing to test-report.md...');

    if (screenshotMatches.length === 0) {
      return;
    }

    fs.writeFileSync(
      'test-report.md',
      `# Failing Snapshots\n${screenshotMatches}`,
      { encoding: 'utf-8' }
    );
  }
}