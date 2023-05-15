import chalk from "chalk";
import { Input } from "./input";
import { Reader, Tokenizer, TokenizerType } from "./tokenizer";

export class SyntaxError extends Error {
    constructor(
        message: string,
        source: Input,
        tnz: Tokenizer
    ) {
        const lines = source.pan([-100, 1], true).split('\n')
        const whitespace = source.eof() ? true : /\s/.test(source.get(0))
        const error_code = source.source.slice(source.index).match(/[^\s]+/)?.[0] || ""
        const code = lines.map((a, i) =>
            i == lines.length - 1 ?
                whitespace ? [`${source.line - lines.length + (i + 1)} `, a] :
                    [`${source.line - lines.length + (i + 1)} `, error_code]
                : [`${source.line - lines.length + (i + 1)} `, a]
        )
        const space = new Array(
            code[code.length - 1][0].length + Math.floor(code[code.length - 1][1].length / (whitespace ? 1 : 2)) + (whitespace ? 1 : 0)
        ).fill(' ').join('')
        const processed = code.map(a => chalk.blue(a[0] + '|') + a[1])
        const tnz_name = tnz.type == TokenizerType.Reader ? '<regex ' + String((tnz as Reader).regex).toString() + '>' : tnz.name
        super(
            message + '\n' +
            chalk.blue(`${source.name ? source.name : './bruh.box'}:${source.line}:${source.column}`) + '\n' +
            `${whitespace ? processed.join('\n') + chalk.magenta.underline(' ') : processed.slice(0, -1).join('\n') + "\n" + chalk.magenta.underline(processed.slice(-1))}\n` +
            `${space}${chalk.magenta('^')} Expected '${tnz_name}', got ${source.eof() ? "'<eof>'" : whitespace ? "'whitespace'" : error_code}`
        )
    }
}

export class UnknownSyntax extends Error {
    constructor(
        message: string,
        source: Input
    ) {
        const error_code = source.source.slice(source.index).match(/[^\s]+/)?.[0] || ""
        super(error_code)
    }
}