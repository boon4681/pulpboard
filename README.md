# Pulpboard

pulpboard is an lexical instruction interpreter.

- Reader
- Wrapper
- WrapperSerial
- IFWrapper
- Group
- GroupSerial

## Insturctions set

Instruction | Desciptions | Example
--- | --- | ---
PUSH | push tokenizer to stack | PUSH A
POP | pop tokenizer from stack | POP A
NED | pop tokenizer from stack without throwing an error | NED A
READ | reading regex | READ A, B
TEST | testing regex | TEST A, B
ADD | adding number to address | ADD A, 10
SET | set value in memory | SET "HI"
CMP \<addr \| int>, \<addr \| int>| compare to int variable and save result to TEMP memory | CMP a, b
ICMP \<int>| compare to id of current stack | ICMP 10
SKIP \<int>| skip indexes of stack | SKIP 1
SIT \<int> | skip indexes of stack if TEMP is true | SIT 1
SIF \<int>| skip indexes of stack if TEMP is false | SIF 1
SADD | stack index add | SADD
END | tell the interpreter that interpreting has ended. | END

```log
===================
- Wrapper 1
   - Reader 1
   - Reader 2
   - Group 1
      - Reader 3
      - Reader 4
   - Reader 5
===================
   Compiled to

Scheme Hashmap
{
    A: Wrapper 1
        B: Reader 1
        C: Reader 2
        D: Group 1
            E: Reader 3
            F: Reader 4
        G: Reader 5
}

Intruction Stack
[
    PUSH A
        READ B, A
        SAD
        CMP A, 1
            JOT 2
            JOF 12
        READ C, A
        SAD
        CMP A, 1
            JOT 2
            JOF 8
        PUSH D
            READ E, A
            SAD
            CMP A, 1
                JOT 4
            READ F, A
            SAD
            CMP A, 1
                JOT 0 // Will removed in optimizing process
        POP
        READ G, A
        CMP A, 1
            JOT 1 // Will removed in optimizing process
            JOF 0 // Will removed in optimizing process
    POP
    END
]
```
