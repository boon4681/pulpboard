import { is_pack, Lexer, Pack, Token, Group } from "../../tokenizer"
import { DepthDebug } from "../debug"
import { Stacker } from "../stacker"


export function group(lexer: Lexer, tokens: Token<any>[], stack: Stacker, debug: DepthDebug, tnz: Group) {
    const group = tnz as Group
    group.update()
    for (; !group.ended; group.next()) {
        const child = group.get()
        if (child.type == "Reader") {
            if (child.test(lexer)) {
                const result = child.read(lexer)
                group.status = "succeed"
                group.ended = true
                if (!child.options.ignore) {
                    tokens.push(result)
                }
                if (child.options.mode == 'push') {
                    const clone = child.options.tokenizer.clone()
                    clone.parent = group
                    stack.push(clone);
                    (lexer as any).add_merger(tokens, clone)
                    break
                }
                if (child.options.mode == 'pop') {
                    if (group.parent) {
                        if (is_pack(group.parent)) {
                            const parent = group.parent as Pack
                            parent.status = group.status
                            parent.next()
                        }
                    }
                    stack.pop();
                    break
                }
                break
            } else if (child.options.nullable) {
                group.status = "succeed"
                group.ended = true
                break
            }
        }
        if (is_pack(child)) {
            group.status = "unprocess"
            const clone = child.clone()
            clone.parent = group
            stack.push(clone);
            (lexer as any).add_merger(tokens, clone)
            break
        }
        group.status = "fail"
    }
    if (group.status == "fail" && group.options.nullable == false) {
        if (stack.step > stack.children.length * 0.7) {
            throw new Error(`No viable alternative.\n${lexer.source.pan([-100, 1], true)}<- is not ${group.name}`)
        }
        lexer.source.pop()
        return false
    }
    if (group.ended) {
        if (group.parent) {
            if (is_pack(group.parent)) {
                const parent = group.parent as Pack
                parent.status = group.status
                parent.next()
            }
        }
        stack.pop()
    }
}