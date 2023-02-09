import { Lexer, Tokenizer } from "../tokenizer"
import { DepthDebug } from "./debug"

export class Stacker {
    step: number = 0
    private update: number = 0

    children: Tokenizer<any, any>[] = []

    constructor(public debug: DepthDebug) { }

    wreak_havoc(lexer: Lexer) {
        if (this.update == this.step) {
            throw new Error(`Lexer cannot eat tokenizer "${this.last().name}"`)
        }
        this.update = this.step
    }

    last() {
        return this.children[this.children.length - 1]
    }

    push(...children: Tokenizer<any, any>[]) {
        this.step++
        this.debug.push()
        return this.children.push(...children)
    }

    pop(...arg: any[]) {
        this.step++
        this.debug.pop(...arg)
        return this.children.pop()
    }
}
