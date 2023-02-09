import { Lexer, Reader, Token } from "../../tokenizer";
import { DepthDebug } from "../debug";
import { Stacker } from "../stacker";


export function reader(lexer: Lexer, tokens: Token<any>[], stack: Stacker,debug: DepthDebug, tnz: Reader) {
    debug.log('@read -', tnz.type, tnz.name)
    if (tnz.test(lexer)) {
        const result = tnz.read(lexer)
        if (!tnz.options.ignore) {
            tokens.push(result)
        }
        if (tnz.options.mode == 'push') {
            const clone = tnz.options.tokenizer.clone()
            stack.push(clone);
            (lexer as any).add_merger(tokens, clone)
        }
        if (tnz.options.mode == 'pop') {
            throw new Error(`No stack to pop ${tnz.name}`)
        }
    } else if (tnz.options.nullable == false) {
        lexer.source.pop()
        return false
    }
}