import { Instruction } from "./instruction"
import { Tokenizer } from "./tokenizer"

export class Stack<T> {
    array: T[] = []
    pointer = 0
    size: number = 0
    constructor(items: T[] = []) {
        this.add(items)
    }
    add(items: T[] | T) {
        const items_ = [items].flat(1) as T[]
        for (let i = 0; i < items_.length; i++) {
            this.array.push(items_[items_.length - 1 - i])
        }
        this.size = this.array.length
        return this
    }
    add_direct(items: T[] | T) {
        const items_ = [items].flat(1) as T[]
        for (let i = 0; i < items_.length; i++) {
            this.array.push(items_[i])
        }
        this.size = this.array.length
        return this
    }
    pop() {
        const pop = this.array.pop()
        this.size = this.array.length
        if (this.pointer > 0 && this.pointer == this.array.length - 1) this.pointer--
        return pop
    }
    get(i: number = 0): T {
        return this.array.slice(- 1 - this.pointer + i)[0]
    }
    next() {
        this.pointer++
        return this.array.slice(- 1 - this.pointer)
    }
    back() {
        if (this.pointer > 0) this.pointer--
        return this.array.slice(- 1 - this.pointer)
    }
}

export class Memory {
    temp: number = 0
    public global: Map<string, number> = new Map()
    public scheme: Tokenizer[] = []
    public stack: Stack<Tokenizer> = new Stack()
    public inst: Stack<Instruction> = new Stack()
    constructor() { }
    public get_address(addr: string) {
        return this.global.get(addr)
    }
    public set_address(addr: string, data: number) {
        this.global.set(addr, data)
    }
}