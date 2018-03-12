import * as path from 'path';
import * as ts from 'typescript';
import { findNodes } from '../utils';


// Load the Compiler Options.
const tsConfig = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
const parsedTsConfig = ts.parseJsonConfigFileContent(tsConfig.config, ts.sys, '.');

// Create the program.
const program = ts.createProgram(parsedTsConfig.fileNames, parsedTsConfig.options);
const tc = program.getTypeChecker();


function _findAllNgComponentClass(sourceFile: ts.SourceFile, metadata: ts.ObjectLiteralExpression) {
  const allNgComponentDeclarations = [] as [string, string][];

  findNodes<ts.PropertyAssignment>(metadata, sourceFile, ts.SyntaxKind.PropertyAssignment)
    .forEach(node => {
      let name = '';
      // Get the node's name.
      switch (node.name.kind) {
        case ts.SyntaxKind.StringLiteral:
          name = (node.name as ts.StringLiteral).text;
          break;
        case ts.SyntaxKind.Identifier:
          name = (node.name as ts.Identifier).text;
          break;
      }

      if (!name) {
        return;
      }

      if (name == 'declarations' && node.initializer.kind == ts.SyntaxKind.ArrayLiteralExpression) {
        findNodes<ts.Identifier>(node.initializer, sourceFile, ts.SyntaxKind.Identifier)
          .forEach(ident => {
            // Find the source of this identifier.
            let symbol: ts.Symbol = tc.getSymbolAtLocation(ident) !;
            // Resolve the symbol back to its declaration.
            while (symbol.flags & ts.SymbolFlags.Alias) {
              symbol = tc.getAliasedSymbol(symbol);
            }

            // Find all declarations (there can be multiple).
            const declarations = symbol.getDeclarations();
            if (!declarations || declarations.length == 0) {
              allNgComponentDeclarations.push([ident.text, 'Unknown']);
            } else {
              allNgComponentDeclarations.push([ident.text, declarations[0].getSourceFile().fileName]);
            }
          });
      }
    });

  return allNgComponentDeclarations;
}


function _checkClassForNgModule(sourceFile: ts.SourceFile, classNode: ts.ClassDeclaration) {
  let found = false;
  let ngModuleMetadata: ts.ObjectLiteralExpression | undefined = undefined;

  // Resolve `@angular/core`'s NgModule for the current file.
  const angularCoreModule = ts.resolveModuleName(
    '@angular/core',
    sourceFile.fileName,
    parsedTsConfig.options,
    ts.sys,
  ).resolvedModule;

  if (!angularCoreModule) {
    return;
  }
  const angularCoreRoot = path.dirname(angularCoreModule.resolvedFileName);

  // Get all decorators of all classes that come from Angular.
  findNodes<ts.Decorator>(classNode, sourceFile, ts.SyntaxKind.Decorator)
    .forEach(decoratorNode => {
      const fnCall = findNodes<ts.CallExpression>(decoratorNode, sourceFile, ts.SyntaxKind.CallExpression, 1)[0];

      let symbol: ts.Symbol = tc.getSymbolAtLocation(fnCall.expression) !;
      // Resolve the symbol back to its declaration.
      while (symbol.flags & ts.SymbolFlags.Alias) {
        symbol = tc.getAliasedSymbol(symbol);
      }

      // Assert this is NgModule.
      if (symbol.escapedName != 'NgModule') {
        return;
      }

      // Find all declarations (there can be multiple).
      const declarations = symbol.getDeclarations() || [];

      if (declarations.some(x => x.getSourceFile().fileName.startsWith(angularCoreRoot))) {
        if (found) {
          throw new Error('Multiple declarations found on a single class...');
        }
        found = true;

        // The metadata is the object literal found as parameter.
        ngModuleMetadata = fnCall.arguments[0] as ts.ObjectLiteralExpression;
        if (!ngModuleMetadata) {
          return;
        }
        if (ngModuleMetadata.kind != ts.SyntaxKind.ObjectLiteralExpression) {
          return;
        }
      }
    });

  if (!found || !ngModuleMetadata) {
    return;
  }


  console.log('Filename: ' + path.relative(process.cwd(), sourceFile.fileName));
  console.log(`  Class ${classNode.name ? JSON.stringify(classNode.name.text) : '<anonymous>'}`);
  console.log(`  Declares components:`);
  _findAllNgComponentClass(sourceFile, ngModuleMetadata)
    .forEach(([symbolName, filePath]) => {
      console.log(`    ${symbolName} (${JSON.stringify(path.relative(process.cwd(), filePath)})`)
    })
}

function _checkFileForNgModule(sourceFile: ts.SourceFile) {
  // Get all the classes
  const allClasses = findNodes<ts.ClassDeclaration>(sourceFile, sourceFile, ts.SyntaxKind.ClassDeclaration);
  if (allClasses.length == 0) {
    return [];
  }

  allClasses.forEach(klass => {
    _checkClassForNgModule(sourceFile, klass);
  });
}


program.getSourceFiles()
  .forEach(sourceFile => {
    _checkFileForNgModule(sourceFile);
  });
