import * as path from 'path';
import * as ts from 'typescript';
import { findNodes } from '../utils';


// Load the Compiler Options.
const tsConfig = ts.readConfigFile('tsconfig.json', ts.sys.readFile);
const parsedTsConfig = ts.parseJsonConfigFileContent(tsConfig.config, ts.sys, '.');

// Create the program.
const program = ts.createProgram(parsedTsConfig.fileNames, parsedTsConfig.options);
const tc = program.getTypeChecker();

// Parse the arguments.
const argv = process.argv.slice(1);
if (argv[1] === undefined) {
    console.log('Usage: do-the-thing fileName');
    process.exit(1);
}
const filePath = path.resolve(process.cwd(), argv[1]);

// Get the sourceFile file of this path.
const sourceFile = program.getSourceFile(filePath);

// Get all the classes
const allClasses = findNodes<ts.ClassDeclaration>(sourceFile, sourceFile, ts.SyntaxKind.ClassDeclaration);
if (allClasses.length == 0) {
    console.error('Woah. No classes.');
    process.exit(2);
}

// If the user passed in a class name, use that class. Otherwise use the first one.
let classNode = allClasses[0];
if (argv[2]) {
    const maybeNode = allClasses.find(x => !!x.name && x.name.text == argv[2]);
    if (maybeNode === undefined) {
        console.log(`Couldn't find class named ${argv[2]}.`);
        process.exit(3);
    }
    classNode = maybeNode !;
}


let found = false;
let ngModuleMetadata: ts.ObjectLiteralExpression;
const angularCoreModule = ts.resolveModuleName('@angular/core', sourceFile.fileName, parsedTsConfig.options, ts.sys).resolvedModule;
if (!angularCoreModule) {
    console.log('Could not resolve @angular/core');
    process.exit(5);
}
const angularCoreRoot = path.dirname(angularCoreModule.resolvedFileName);

// Get all decorators of all classes that come from Angular.
findNodes<ts.Decorator>(classNode, sourceFile, ts.SyntaxKind.Decorator)
    .forEach(decoratorNode => {
        const fnCall = findNodes<ts.CallExpression>(decoratorNode, sourceFile, ts.SyntaxKind.CallExpression, 1)[0];
        // Ignore non-function call expressions.
        if (!fnCall) {
            return;
        }
        // Ignore function calls that are not simple identifier.
        if (fnCall.expression.kind !== ts.SyntaxKind.Identifier) {
            return;
        }

        const id = fnCall.expression as ts.Identifier;
        let symbol: ts.Symbol = tc.getSymbolAtLocation(id) !;
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
                console.log('Multiple declarations found...');
                process.exit(6);
            }
            found = true;

            // The metadata is the object literal found as parameter.
            ngModuleMetadata = fnCall.arguments[0] as ts.ObjectLiteralExpression;
            if (!ngModuleMetadata) {
                console.log('NgModule found but no argument.');
                process.exit(7);
            }
            if (ngModuleMetadata.kind != ts.SyntaxKind.ObjectLiteralExpression) {
                console.log('Argument found but it is not an object literal.');
                process.exit(8);
            }
        }
    });

if (!found) {
    console.log('Could not find metadata... :sad-panda:');
    process.exit(9);
}


console.log('Found!');
console.log(ngModuleMetadata.getFullText());
