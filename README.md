# Pulpboard

pulpboard is a lexical instruction interpreter.

## Instructions

Pulpboard provides several classes for defining lexical instructions:

- **Reader** - Matches a regular expression and returns a single token.
  
  ```ts
  new Reader("name",/regex/)
  ```

- **Wrapper** - Matches a sequence of instructions in order, throwing a `SyntaxError` if the input does not follow the expected order.

  ```ts
  const parent = new Wrapper("<name>")
  parent.add([
    new Reader("open",/\(/),
    parent.New(),
    new Reader("close",/\)/)
  ])
  ```

  Note: `The Wrapper.New()` method is used to create a new instance of the Wrapper class to prevent recursion during compile time.

  The output tokens are not grouped together by default. However, you can group them together using the `Wrapper.set("merge", true)`.

  ```ts
  const name = new Wrapper("<name>")
  name.set("merge",true)
  ```

- **WrapperSerial** - Matches a sequence of instructions in order, repeating the pattern until the input cannot be matched anymore, throwing a `SyntaxError` if the input does not follow the expected order.

  ```ts
  const loop = new WrapperSerial("<loop>")
  loop.add([
    new Reader("open",/\(/),
    loop.New(),
    new Reader("close",/\)/)
  ])
  ```

- **IFWrapper** - Matches a sequence of instructions in order, but only if a condition is true.

  ```ts
  const condition = new Reader("number",/\d/)
  const name = new IFWrapper("<name>",condition)
  name.add([
    // instructions
  ])
  ```

- **Group** - Matches a sequence of instructions in order, returning the first matching token. if any of the instructions cannot be followed, it throws a `SyntaxError`.

  ```ts
  const name = new Group("<name>",condition)
  name.add([
    new Reader("int", /\d+/),
    new Reader("float",/\d+\.\d+/)
  ])
  ```

- **GroupSerial** - The GroupSerial is working like normal Group but it will repeat until it's unable to follow the instructions.

  ```ts
  const name = new GroupSerial("<name>",condition)
  name.add([
    new Reader("int", /\d+/),
    new Reader("float",/\d+\.\d+/)
  ])
  ```

## Errors

Pulpboard has two types of errors: SyntaxError and UnknownSyntax.

- **SyntaxError**: Thrown when the set of instructions cannot be followed in order.

- **UnknownSyntax**: Thrown when the input string does not match any of the defined instructions.

## Micro Insturctions

Not avaliable for normal user. micro instructions are subset of Instructions

Instruction | Desciptions | Example
--- | --- | ---
PUSH | push tokenizer to stack | PUSH A
POP | pop tokenizer from stack | POP A
NED | pop tokenizer from stack without throwing an error | NED A
READ | reading regex | READ A, B
TEST | testing regex | TEST A, B
SET | set value in memory | SET "HI"
CMP \<addr \| int>, \<addr \| int>| compare to int variable and save result to TEMP memory | CMP a, b
SKIP \<int>| skip indexes of stack | SKIP 1
SIT \<int> | skip indexes of stack if TEMP is true | SIT 1
SIF \<int>| skip indexes of stack if TEMP is false | SIF 1
SADD | stack index add | SADD
END | tell the interpreter that interpreting has ended. | END
