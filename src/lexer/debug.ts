import { Tokenizer } from "../tokenizer";

export class DepthDebug {
    depth: number = 0

    constructor(public disable: boolean) { }

    strip(tnz: Tokenizer<any, any>) {
        if (this.disable) return;

        const depth: string[] = []
        const stack: Tokenizer<any, any>[] = [tnz]
        while (stack.length > 0) {
            const i = stack.pop()
            if (i) {
                depth.push(i.name)
                if (i.parent) {
                    stack.push(i.parent)
                }
            }
        }
        if (depth.length > 5) {
            return '...'+depth.reverse().slice(depth.length - 5).join(" > ")
        }
        return depth.reverse().join(" > ")
    }

    log(...arg: any) {
        if (this.disable) return;
        if (arg.length == 0) return;

        const u = arg.map((a: any) => {
            // if (typeof a == "object") {
            //     return JSON.stringify(a)
            // }
            return a
        })
        if (this.depth == 0) {
            console.log(...u)
        } if (this.depth > 0) {
            console.log(new Array(this.depth).fill("").join("    "), ...u)
            // console.log(this.depth+'|', ...u)
        } else {
            console.log(...u)
        }
    }

    lpp(...arg: any) {
        if (arg.length == 0) return;
        this.depth += 1
        this.log(...arg)
        this.depth -= 1
    }

    push(...arg: any) {
        this.depth += 1
        this.log(...arg)
    }

    pop(...arg: any) {
        this.log(...arg)
        this.depth -= 1
        if (this.depth < 0) {
            console.log(...arg)
            throw new Error()
        }
        // console.log(this.depth)
    }
}