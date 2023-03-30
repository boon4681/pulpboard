import chalk from "chalk";
import { Input } from "./input";
import { Reader, Tokenizer } from "./tokenizer";

export class SyntaxError extends Error {
    constructor(
        message: string,
        source: Input,
        tnz: Tokenizer
    ) {
        const lines = source.pan([-100, 1], true).split('\n')
        const whitespace = source.eof() ? true : /\s/.test(source.get(0))
        const code = lines.map((a, i) => [`${i + 1} `, a])
        const space = new Array(
            code[code.length - 1][0].length + code[code.length - 1][1].length + (whitespace ? 1 : 0)
        ).fill(' ').join('')
        const processed = code.map(a => chalk.blue(a[0] + '|') + a[1]).join('\n')
        const tnz_name = tnz instanceof Reader ? '<regex ' + String(tnz.regex).toString() + '>' : tnz.name
        super(
            message + '\n' +
            chalk.blue(`${source.name ? source.name : './bruh.box'}:${source.line}:${source.column}`) + '\n' +
            `${whitespace ? processed + chalk.magenta.underline(' ') : processed.slice(0, -1) + chalk.magenta.underline(processed.slice(-1))}\n` +
            `${space}${chalk.magenta('^')} Expected '${tnz_name}', got ${source.eof() ? "'<eof>'" : whitespace ? "'whitespace'" : source.get(0)}`
        )
    }
}