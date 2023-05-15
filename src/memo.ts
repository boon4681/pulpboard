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
        if(Array.isArray(items)){
            for (let i = 0; i < items.length; i++) {
                this.array.push(items[items.length - 1 - i])
            }
        }else{
            this.array.push(items)
        }
        this.size = this.array.length
        return this
    }
    pop() {
        this.size = this.array.length-- - 1
        if (this.pointer && this.pointer == this.array.length - 1) this.pointer--
    }
    get(i: number = 0): T {
        return this.array[this.array.length - 1 - this.pointer + i]
        return this.array.slice(- 1 - this.pointer + i)[0]
    }
}

export class Memory {
    temp: number = 0
    public stack: Stack<Tokenizer> = new Stack()
    public inst: Instruction[] = []
    public A: number = 0
    public B: number = 0
    public T: number = 0
    constructor() { }
    public get_address(addr: string) {
        switch (addr) {
            case "A":
                return this.A
            case "B":
                return this.B
            case "T":
                return this.T
        }
        return 0
    }
    public set_address(addr: string, data: number) {
        switch (addr) {
            case "A":
                return this.A = data
            case "B":
                return this.B = data
            case "T":
                return this.T = data
        }
    }
}