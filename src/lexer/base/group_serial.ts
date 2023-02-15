import { is_pack, Lexer, Pack, Token, GroupSerial } from "../../tokenizer"
import { DepthDebug } from "../debug"
import { Stacker } from "../stacker"



export function group_serial(lexer: Lexer, tokens: Token<any>[], stack: Stacker, debug: DepthDebug, tnz: GroupSerial) {
    const group = tnz as GroupSerial
    group.update()
    debug.log('@start -', group.type, group.name)
    if (group.status == "succeed") {
        group.ended = true
    }
    for (; !group.ended; group.next()) {
        const child = group.get()
        if (child.type == "Reader") {
            if (child.test(lexer)) {
                const result = child.read(lexer)
                group.status = "succeed"
                group.ended = true
                lexer.source.wreak_havoc({
                    err: new Error(`${lexer.source.pan([-100, 0], true)}<- Zero size token leaded to endless loop "${group.name} > ${child.name}"`)
                })
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
                    stack.pop('@pop -', group.type, group.name);
                    break
                }
                break
            }
        }
        if (is_pack(child)) {
            const clone = child.clone()
            clone.parent = group
            stack.push(clone);
            (lexer as any).add_merger(tokens, clone)
            break
        }
        group.status = "fail"
    }
    if (group.status == "fail" && group.options.nullable == false && group.parent?.type !== "GroupSerial") {
        if (stack.step > stack.children.length * 0.7) {
            throw new Error(`No viable alternative.\n${lexer.source.pan([-100, 1], true)}<- is not ${group.name}`)
        }
        lexer.source.pop()
        return false
    }
    if (group.ended) {
        const clone = group.clone() as GroupSerial
        clone.parent = group
        if (group.parent && !group.self_end) {
            if (is_pack(group.parent)) {
                const parent = group.parent as Pack
                if (parent.type == "GroupSerial") {
                    parent.ended = true;
                    (parent as GroupSerial).self_end = true;
                }
                parent.status = group.status
                parent.next()
            }
        }
        if (group.status == "succeed") {
            stack.push(clone);
            (lexer as any).add_merger(tokens, clone)
        } else {
            stack.pop('@pop -', group.type, group.name)
        }
    }
}