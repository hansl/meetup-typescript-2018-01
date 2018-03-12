// Bootstrap the devkit locally.
import '@angular-devkit/devkit';

import { logging, normalize, resolve, terminal } from '@angular-devkit/core';
import { NodeJsSyncHost, createConsoleLogger } from '@angular-devkit/core/node';
import { Arborist, languages } from '@angular-devkit/arborist';
import {
  allOf,
  angular,
  anyOf,
  descendants,
  first,
  firstOfFile,
  html,
  typescript,
} from '@angular-devkit/arborist/match';
import { map, mergeMap } from 'rxjs/operators';

const { blue, bold, green, yellow } = terminal;
const logger = createConsoleLogger();

const arborist = new Arborist();
const host = new NodeJsSyncHost();

const tsConfigPath = resolve(normalize(process.cwd()), normalize('./tsconfig.json'));
const typescriptLanguage = new languages.typescript.TypeScriptLanguage(host, tsConfigPath);
arborist.registerLanguage(typescriptLanguage);

arborist.match(angular.module(), { language: typescriptLanguage, }).pipe(
  // mergeMap(moduleMatch => {
  //   return arborist.submatch(moduleMatch,
  //     descendants(
  //       typescript.objectLiteral(),
  //       typescript.objectProperty(
  //         { equals: 'declarations' },
  //         typescript.arrayLiteral(),
  //       ),
  //     ),
  //   ).pipe(
  //     map(submatch => [moduleMatch, submatch]),
  //   );
  // }),
)
  .subscribe(match => {
    const start = match.start;
    const end = match.end;

    logger.info(
      green(match.path || '???')
      + yellow(`@(${start.line}, ${start.character})..(${end.line}, ${end.character}) `)
      + blue(`[${match.language.name}]`) + green(':'),
    );

    new logging.IndentLogger('node-text', logger, bold(blue('|')))
      .info(match.text);
    logger.info('');
  });
