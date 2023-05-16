type stack = { index: number, line: number, column: number, size: number, last_index: number }

export class Input {
    index: number = 0
    line: number = 1
    column: number = 0
    size: number


    last_index: number = 0

    test_count: number = 0

    stack: stack[] = []

    constructor(public name: string, public source: string) {
        this.size = source.length
    }

    push() {
        this.test_count++
        return this.stack.unshift({
            index: this.index,
            line: this.line,
            column: this.column,
            size: this.size,
            last_index: this.last_index
        })
    }

    pop() {
        const current = {
            index: this.index,
            line: this.line,
            column: this.column,
            size: this.size,
            last_index: this.last_index
        }
        const state = this.stack.shift()
        if (state) {
            this.index = state.index
            this.line = state.line
            this.column = state.column
            this.size = state.size
            this.last_index = state.last_index
        }
        return current
    }

    set(state: stack) {
        this.index = state.index
        this.line = state.line
        this.column = state.column
        this.size = state.size
        this.last_index = state.last_index
    }

    private validate_move(step: number) {
        const value = this.index + step
        if (value < 0) {
            throw new Error(`index must be more than one. [0,${this.size}] ${value}`)
        }
        if (value > this.size) {
            throw new Error(`index must be lower than input size. [0,${this.size}] ${value}`)
        }
        return true
    }

    private clamp(step: number) {
        const value = this.index + step
        if (value < 0) {
            return 0
        }
        if (value > this.size) {
            return this.size
        }
        return value
    }

    cl(value: number) {
        if (value < 0) {
            return 0
        }
        if (value > this.size) {
            return this.size
        }
        return value
    }

    private find_newline(str: string) {
        let a = 0
        let l = 0
        for (let i = 0; i < str.length; i++) {
            if (str.charCodeAt(i) == 10) {
                a++
                l = i
            }
        }
        return a > 0 ? [a, l] : undefined
    }

    private update_line(step: number, str: string) {
        const m = this.find_newline(str)
        if (m) {
            if (step >= 0) {
                this.line += m[0]
            } else {
                this.line -= m[0]
            }
            this.column = str.length - m[1]
        } else {
            this.column += step
        }
    }

    wreak_havoc(i?: { result?: boolean, err?: Error }) {
        if (i) {
            if (this.last_index === this.index && !this.eof() && !i.result) {
                if (i && i.err) {
                    throw i.err
                }
                throw new Error("A havoc was happened somewhere in pulpboard")
            }
        } else {
            if (this.last_index === this.index && !this.eof()) {
                throw new Error("A havoc was happened somewhere in pulpboard")
            }
        }
        this.last_index = this.index
    }

    get(index: number, clamp?: boolean) {
        if (clamp) {
            return this.source[this.clamp(index)]
        }
        this.validate_move(index)
        return this.source[this.index + index]
    }

    move(step: number) {
        this.validate_move(step)
        return this.index + step
    }

    seek(step: number, clamp?: boolean) {
        if (clamp) {
            this.last_index = this.index + 0
            const result = this.source.slice(this.index, this.index = this.clamp(step))
            this.update_line(step,result)
            return result
        }
        this.validate_move(step)
        this.last_index = this.index + 0
        const result = this.source.slice(this.index, this.index = this.clamp(step))
        this.update_line(step,result)
        return result
    }

    pan(range: [number, number], clamp?: boolean) {
        if (clamp) {
            return this.source.slice(this.clamp(range[0]), this.clamp(range[1])).replace(/\r/g, '')
        }
        this.validate_move(range[0])
        this.validate_move(range[1])
        range[0] += this.index - 1
        range[1] += this.index - 1
        return this.source.slice(range[0], range[1])
    }

    pospan(range: [number, number]) {
        return this.source.slice(range[0], range[1])
    }

    to_end() {
        return this.source.slice(this.index)
    }

    code(step: number) {
        return this.source.charCodeAt(this.index + step)
    }

    eof() {
        return this.index == this.size
    }

    eol() {
        return this.code(0) === '\n'.charCodeAt(0) || this.eof()
    }

    skip() {
        this.index += 1
    }

    skip_char(char: string) {
        if (char.charCodeAt(0) == this.code(0)) {
            this.skip()
        }
    }

    skip_until_not(char: string) {
        while (char.charCodeAt(0) == this.code(0)) {
            this.skip()
        }
    }
}