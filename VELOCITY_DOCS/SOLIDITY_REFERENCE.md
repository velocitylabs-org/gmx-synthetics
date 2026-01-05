# Essential Concepts for Reading GMX V2 Contracts

This guide covers all the Solidity concepts, patterns, and language features you need to understand, read and comprehend this codebase. Read this and you'll be equipped to navigate the contracts. Each concept includes a "See it in action" section pointing to real contract files where the concept is used.

---

## Table of Contents

1. [Basic Solidity Syntax](#1-basic-solidity-syntax)
2. [Data Types](#2-data-types)
3. [Visibility Modifiers](#3-visibility-modifiers)
4. [Functions](#4-functions)
5. [Structs & Enums](#5-structs--enums)
6. [Mappings & Arrays](#6-mappings--arrays)
7. [Storage, Memory & Calldata](#7-storage-memory--calldata)
8. [Inheritance](#8-inheritance)
9. [Interfaces](#9-interfaces)
10. [Libraries](#10-libraries)
11. [Modifiers](#11-modifiers)
12. [Events](#12-events)
13. [Error Handling](#13-error-handling)
14. [Access Control Patterns](#14-access-control-patterns)
15. [Reentrancy Guards](#15-reentrancy-guards)
16. [Assembly & Low-Level Calls](#16-assembly--low-level-calls)
17. [External Call Patterns](#17-external-call-patterns)
18. [Math & Type Casting](#18-math--type-casting)
19. [Key-Value Storage Pattern](#19-key-value-storage-pattern)
20. [DeFi-Specific Patterns](#20-defi-specific-patterns)
21. [Common Naming Conventions](#21-common-naming-conventions)
22. [Quick Reference Cheat Sheet](#22-quick-reference-cheat-sheet)

---

## 1. Basic Solidity Syntax

### What's a Solidity File?

Every `.sol` file starts like this:

```solidity
// SPDX-License-Identifier: BUSL-1.1  // License (required by law)
pragma solidity ^0.8.0;               // "I need compiler version 0.8.x"
```

### What's a Contract?

Think of a contract like a **class in JavaScript/Python** - it holds data and functions:

```solidity
contract Bank {
    // Variables (data) go here
    // Functions (behavior) go here
}
```

### Constructor = Setup Function

Runs **once** when the contract is deployed. Like `__init__` in Python:

```solidity
constructor(address _owner) {
    owner = _owner;  // Save who deployed this
}
```

### Immutable = "Set Once, Never Change"

Variables marked `immutable` are set in the constructor and **can never be changed**. Reading them is cheap (gas-efficient).

**📍 See it in action:** [`contracts/bank/Bank.sol`](../contracts/bank/Bank.sol#L16-L20)
```solidity
DataStore public immutable dataStore;  // Set once, read forever

constructor(RoleStore _roleStore, DataStore _dataStore) RoleModule(_roleStore) {
    dataStore = _dataStore;  // Set here, locked forever
}
```

---

## 2. Data Types

### Numbers

```solidity
uint256   // Positive only: 0 to a huge number (2^256-1)
int256    // Positive OR negative: -huge to +huge
```

**Key Point**: Solidity 0.8+ automatically crashes if numbers overflow. No extra safety needed.

### Boolean (true/false)

```solidity
bool isLong = true;      // Is this a long position?
bool shouldUnwrap = false;  // Should we unwrap tokens?
```

**📍 See it in action:** [`contracts/position/Position.sol`](../contracts/position/Position.sol) - positions have `isLong` flag

### Address (Wallet/Contract Location)

```solidity
address account;              // Any wallet or contract address
address payable receiver;     // Address that can receive ETH/AVAX
```

**What's `payable`?** It means "this address can receive money". Without it, sending ETH fails.

**📍 See it in action:** [`contracts/bank/Bank.sol`](../contracts/bank/Bank.sol) uses `address payable` for receivers

### bytes32 (Fixed-Size Data)

Think of `bytes32` as a **fixed-size box** that holds exactly 32 bytes. Perfect for IDs and keys.

```solidity
bytes32 key;  // Used everywhere for storage keys
```

**📍 See it in action:** [`contracts/data/Keys.sol`](../contracts/data/Keys.sol) - ALL keys are `bytes32`

```solidity
// From contracts/order/OrderStoreUtils.sol:17
bytes32 public constant ACCOUNT = keccak256(abi.encode("ACCOUNT"));
```

This creates a unique ID from the string "ACCOUNT" using a hash function.

---

## 3. Visibility Modifiers

### Who Can Call This Function?

| Keyword | Who can call it? |
|---------|------------------|
| `public` | Anyone (inside or outside) |
| `external` | Only from outside (other contracts, users) |
| `internal` | Only this contract or children |
| `private` | Only this contract |

**Simple rule:** Use `external` for functions users call. Use `internal` for helper functions.

**📍 See it in action:** [`contracts/bank/Bank.sol`](../contracts/bank/Bank.sol#L29-L35)
```solidity
// External = users/keepers call this
function transferOut(address token, address receiver, uint256 amount) external {
    _transferOut(token, receiver, amount);  // Calls internal helper
}

// Internal = only used inside, starts with underscore
function _transferOut(address token, address receiver, uint256 amount) internal {
    // actual transfer logic
}
```

### View and Pure = "Read-Only" Functions

```solidity
// view = "I only READ data, I don't change anything"
function getBalance() external view returns (uint256) {
    return balance;
}

// pure = "I don't even read data, just do math"
function add(uint256 a, uint256 b) internal pure returns (uint256) {
    return a + b;
}
```

**📍 See it in action:** [`contracts/utils/Calc.sol`](../contracts/utils/Calc.sol) - all pure math functions

---

## 4. Functions

### Basic Function Structure

```solidity
function doSomething(uint256 amount) external returns (uint256) {
//       ^ name       ^ input           ^ who calls  ^ output
    return amount * 2;
}
```

### Multiple Return Values

Functions can return multiple things at once:

```solidity
function getInfo() external view returns (uint256 size, bool isLong) {
    return (100, true);  // Returns two values
}

// Calling it - grab both values:
(uint256 size, bool isLong) = contract.getInfo();
```

**📍 See it in action:** [`contracts/reader/Reader.sol`](../contracts/reader/Reader.sol) - many multi-return view functions

### receive() = "Handle Incoming ETH"

When someone sends ETH to your contract with no data, `receive()` runs:

```solidity
receive() external payable {
    // Someone sent ETH! Do something with it.
}
```

**📍 See it in action:** [`contracts/bank/Bank.sol`](../contracts/bank/Bank.sol#L22-L27)
```solidity
receive() external payable {
    address wnt = TokenUtils.wnt(dataStore);
    if (msg.sender != wnt) {
        revert Errors.InvalidNativeTokenSender(msg.sender);
    }
}
```
This says: "Only accept ETH from the wrapped native token contract (WETH/WAVAX)"

---

## 5. Structs & Enums

### Enum = Named Options

An enum is a list of options. Instead of remembering "0 = swap, 1 = increase...", you use readable names:

**📍 See it in action:** [`contracts/order/Order.sol`](../contracts/order/Order.sol#L12-L34)
```solidity
enum OrderType {
    MarketSwap,       // 0 - swap tokens now
    LimitSwap,        // 1 - swap when price is right
    MarketIncrease,   // 2 - open position now
    LimitIncrease,    // 3 - open when price is right
    MarketDecrease,   // 4 - close position now
    Liquidation       // 7 - forced close
}

// Using it:
if (order.orderType == OrderType.Liquidation) {
    // handle liquidation
}
```

### Struct = Group of Related Data

Think of a struct like a JavaScript object - it groups related fields together:

**📍 See it in action:** [`contracts/market/Market.sol`](../contracts/market/Market.sol#L37-L42)
```solidity
struct Props {
    address marketToken;   // The LP token
    address indexToken;    // What price we track (ETH, BTC)
    address longToken;     // Collateral for longs
    address shortToken;    // Collateral for shorts
}
```

### Nested Structs = Structs Inside Structs

When you have LOTS of fields, group them into sub-structs:

**📍 See it in action:** [`contracts/order/Order.sol`](../contracts/order/Order.sol#L48-L132)
```solidity
struct Props {
    Addresses addresses;    // All address fields grouped
    Numbers numbers;        // All number fields grouped
    Flags flags;            // All boolean fields grouped
}

struct Addresses {
    address account;        // Who placed the order
    address receiver;       // Who gets the output
    address market;         // Which market
}

struct Flags {
    bool isLong;                    // Long or short?
    bool shouldUnwrapNativeToken;   // Convert WETH to ETH?
}
```

**Why?** Solidity has a limit on local variables. Grouping prevents "Stack too deep" errors.

---

## 6. Mappings & Arrays

### Mapping = Dictionary/Hash Map

A mapping is like a dictionary: you give it a key, it gives you a value.

```solidity
mapping(bytes32 => uint256) public prices;  // key → value

// Set a value
prices[someKey] = 1000;

// Get a value
uint256 price = prices[someKey];  // Returns 1000
```

**📍 See it in action:** [`contracts/data/DataStore.sol`](../contracts/data/DataStore.sol#L20-L51)
```solidity
mapping(bytes32 => uint256) public uintValues;    // Store numbers
mapping(bytes32 => address) public addressValues; // Store addresses
mapping(bytes32 => bool) public boolValues;       // Store true/false
```

### Nested Mapping = Dictionary of Dictionaries

```solidity
// "Does this account have this role?"
mapping(address => mapping(bytes32 => bool)) roleCache;

// Usage:
roleCache[userAddress][ADMIN_ROLE] = true;
bool isAdmin = roleCache[userAddress][ADMIN_ROLE];
```

**📍 See it in action:** [`contracts/role/RoleStore.sol`](../contracts/role/RoleStore.sol) - role permissions

### Arrays = Lists

```solidity
address[] public tokens;      // List of tokens
tokens.push(newToken);        // Add to end
tokens.pop();                 // Remove from end
uint256 count = tokens.length; // How many?
address first = tokens[0];    // Get by index
```

### EnumerableSet = List You Can Search

**The problem:** Mappings can't be looped through. You can't ask "who are all the admins?"

**The solution:** EnumerableSet gives you a list that's fast to search AND iterate.

**📍 See it in action:** [`contracts/role/RoleStore.sol`](../contracts/role/RoleStore.sol)
```solidity
EnumerableSet.Bytes32Set internal roles;  // All role types
EnumerableSet.AddressSet internal roleMembers;  // Who has each role

// You can loop through all roles:
for (uint i = 0; i < roles.length(); i++) {
    bytes32 role = roles.at(i);
}

// AND check membership instantly:
bool exists = roles.contains(someRole);  // Fast!
```

---

## 7. Storage, Memory & Calldata

**Where does data live?** This affects cost and persistence.

### Storage = Permanent (Expensive)

Data saved **forever** on the blockchain. Like a database.

```solidity
mapping(bytes32 => uint256) public prices;  // This is storage

function setPrice(bytes32 key, uint256 price) external {
    prices[key] = price;  // Writes to blockchain = costs gas
}
```

**📍 See it in action:** All state variables in [`contracts/data/DataStore.sol`](../contracts/data/DataStore.sol)

### Memory = Temporary (Cheap)

Data exists **only during the function call**. Then it's gone.

```solidity
function process(Order.Props memory order) internal {
    // 'order' is a temporary copy
    // Changes here don't affect the original
    // When function ends, 'order' disappears
}
```

### Calldata = Read-Only Input (Cheapest)

For function parameters you **won't modify**. Super cheap.

```solidity
function createOrder(
    CreateOrderParams calldata params  // Can read, can't change
) external {
    address account = params.receiver;  // Reading is fine
    // params.receiver = x;  // ERROR! Can't modify calldata
}
```

**📍 See it in action:** [`contracts/exchange/OrderHandler.sol`](../contracts/exchange/OrderHandler.sol) - all params are `calldata`

### Quick Reference

| Where | Persists? | Can Modify? | Cost |
|-------|-----------|-------------|------|
| `storage` | Forever | Yes | $$$ |
| `memory` | During function | Yes | $$ |
| `calldata` | During function | No | $ |

---

## 8. Inheritance

### What is Inheritance?

One contract can **copy** all the code from another contract. Like a child inheriting from a parent.

```solidity
contract Child is Parent {
    // Child has all of Parent's variables and functions
}
```

**📍 See it in action:** [`contracts/bank/Bank.sol`](../contracts/bank/Bank.sol)
```solidity
contract Bank is RoleModule {
    // Bank gets all of RoleModule's code for free!
}
```

### Multiple Inheritance

A contract can inherit from MULTIPLE parents:

**📍 See it in action:** [`contracts/exchange/OrderHandler.sol`](../contracts/exchange/OrderHandler.sol#L16)
```solidity
contract OrderHandler is IOrderHandler, BaseOrderHandler, ReentrancyGuard {
    // Gets code from ALL three parents
}
```

### Constructor Chaining = "Call Parent's Setup First"

If a parent has a constructor, the child **must** call it:

**📍 See it in action:** [`contracts/bank/Bank.sol`](../contracts/bank/Bank.sol#L18-L20)
```solidity
constructor(
    RoleStore _roleStore,
    DataStore _dataStore
) RoleModule(_roleStore) {  // <-- Calls parent constructor first!
    dataStore = _dataStore;  // Then does its own setup
}
```

### Abstract = "Template Contract"

An `abstract` contract can't be deployed alone - it's meant to be inherited.

**📍 See it in action:** [`contracts/utils/GlobalReentrancyGuard.sol`](../contracts/utils/GlobalReentrancyGuard.sol)
```solidity
abstract contract GlobalReentrancyGuard {
    // This is a template - you can't deploy it directly
    // Other contracts inherit from it
}
```

### Virtual & Override = "Customize Parent's Function"

- `virtual` = "Children CAN change this function"
- `override` = "I'm changing the parent's function"

```solidity
// Parent says: "You can customize this"
function process() internal virtual { }

// Child says: "I'm customizing it"
function process() internal override {
    // My custom code
}
```

---

## 9. Interfaces

### What is an Interface?

An interface is a **promise**: "Any contract that claims to be this type MUST have these functions."

Think of it like a USB port - anything that fits the USB standard will work.

### Simple Example

```solidity
// Interface = "You MUST have these functions"
interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
}
```

Now ANY token (USDC, WETH, whatever) that implements `IERC20` can be used the same way:

```solidity
// This works with ANY ERC20 token!
IERC20 token = IERC20(tokenAddress);
uint256 balance = token.balanceOf(myAddress);
token.transfer(recipient, 100);
```

**📍 See it in action:** [`contracts/callback/IOrderCallbackReceiver.sol`](../contracts/callback/IOrderCallbackReceiver.sol)
```solidity
interface IOrderCallbackReceiver {
    function afterOrderExecution(bytes32 key, ...) external;
    function afterOrderCancellation(bytes32 key, ...) external;
}
```

Any contract that wants to receive order callbacks MUST implement these functions.

### Why Interfaces Matter

**📍 See it in action:** Throughout the codebase

```solidity
// The codebase doesn't care WHICH token you use
// As long as it's an IERC20, it works!
IERC20(token).safeTransfer(receiver, amount);
```

### Interface Rules

- Names start with `I` (IERC20, IOrderHandler)
- All functions are `external`
- No variables, no constructors, no code - just function signatures

---

## 10. Libraries

### What is a Library?

A library adds new functions to existing types. It's like giving superpowers to basic types.

### The Magic: `using X for Y`

This line says "add all functions from library X to type Y":

```solidity
using SafeCast for uint256;  // uint256 now has extra functions!

uint256 num = 100;
int256 signed = num.toInt256();  // New power! Convert safely
```

**📍 See it in action:** [`contracts/order/Order.sol`](../contracts/order/Order.sol)
```solidity
library Order {
    // Add helper functions to Order.Props struct
    function account(Props memory props) internal pure returns (address) {
        return props.addresses.account;
    }
}
```

Now you can write:
```solidity
using Order for Order.Props;

Order.Props memory order;
address acc = order.account();  // Clean! Reads like English
```

### Common Libraries in This Codebase

**📍 See it in action:** Throughout the codebase

```solidity
// SafeCast - safely convert between number types
using SafeCast for uint256;
int256 signed = unsignedValue.toInt256();

// SafeERC20 - safely transfer tokens
using SafeERC20 for IERC20;
token.safeTransfer(receiver, amount);

// EnumerableSet - iterable sets
using EnumerableSet for EnumerableSet.AddressSet;
admins.add(newAdmin);
admins.contains(someAddress);
```

### Why Libraries?

Without: `SafeCast.toInt256(value)` - ugly
With: `value.toInt256()` - clean, readable

**📍 Key library files:**
- `contracts/order/Order.sol` - Order helper functions
- `contracts/position/Position.sol` - Position helper functions
- `contracts/utils/Calc.sol` - Math utilities

---

## 11. Modifiers

### What is a Modifier?

A modifier is a **check that runs before your function**. If the check fails, the function never runs.

Think of it like a bouncer at a club - if you're not on the list, you don't get in.

### Simple Example

```solidity
modifier onlyOwner() {
    require(msg.sender == owner, "Not owner");
    _;  // <-- This is where the function code runs
}

function doSomething() external onlyOwner {
    // This code ONLY runs if the modifier check passed
}
```

**📍 See it in action:** [`contracts/role/RoleModule.sol`](../contracts/role/RoleModule.sol)
```solidity
modifier onlyController() {
    if (!roleStore.hasRole(msg.sender, Role.CONTROLLER)) {
        revert Errors.Unauthorized(msg.sender, "CONTROLLER");
    }
    _;  // Function runs here if check passed
}
```

### Using Modifiers

Just add the modifier name after the function visibility:

**📍 See it in action:** [`contracts/bank/Bank.sol`](../contracts/bank/Bank.sol)
```solidity
function transferOut(address token, address receiver, uint256 amount)
    external
    onlyController  // <-- Check: is caller a controller?
{
    // Only runs if caller has CONTROLLER role
}
```

### Common Modifiers in This Codebase

| Modifier | What it checks |
|----------|----------------|
| `onlyController` | Is caller a CONTROLLER? |
| `onlyOrderKeeper` | Is caller an ORDER_KEEPER? |
| `globalNonReentrant` | Prevent reentrancy attacks |

**📍 See definitions in:** [`contracts/role/RoleModule.sol`](../contracts/role/RoleModule.sol)

---

## 12. Events

### What are Events?

Events are **cheap logs** saved on the blockchain. Off-chain apps (like frontends) can listen for them.

Think of events like a news feed - they broadcast "something happened!" without storing heavy data.

### Simple Example

```solidity
// Define an event
event OrderCreated(bytes32 indexed orderId, address indexed account);

// Emit it when something happens
emit OrderCreated(orderId, msg.sender);
```

**`indexed`** = You can search/filter by this field

**📍 See it in action:** [`contracts/event/EventEmitter.sol`](../contracts/event/EventEmitter.sol)

This codebase uses a generic event system - all events go through `EventEmitter`:

```solidity
event EventLog(
    address msgSender,
    string eventName,
    string indexed eventNameHash,
    EventUtils.EventLogData eventData
);
```

### Why Events?

| Storage | Events |
|---------|--------|
| Expensive | Cheap |
| Can read from contracts | Can only read off-chain |
| Persistent | Also persistent, but different |

**Use events for:** Order created, position opened, trade executed, etc.

**📍 Key file:** [`contracts/event/EventEmitter.sol`](../contracts/event/EventEmitter.sol) - central event hub

---

## 13. Error Handling

### Understanding Custom Errors (Simple Example)

**What are errors?** Ways to stop execution and tell the user what went wrong.

**The Old Way - require() with strings:**
```solidity
function adopt(uint256 age) external {
    require(age >= 18, "Must be 18 or older");  // String stored on blockchain = expensive!
}
```

**The New Way - Custom Errors (Solidity 0.8.4+):**
```solidity
// Step 1: Define your errors (like defining a struct)
error TooYoung(uint256 age, uint256 required);
error NotOwner(address caller);

// Step 2: Use them with 'revert'
function adopt(uint256 age) external {
    if (age < 18) {
        revert TooYoung(age, 18);  // No string storage = cheap!
    }
}
```

**Side-by-side comparison:**
```solidity
// OLD - stores "Must be 18" on blockchain (costs gas)
require(age >= 18, "Must be 18 or older");

// NEW - no string storage, includes actual values!
if (age < 18) {
    revert TooYoung(age, 18);  // Tells you: age was 15, needed 18
}
```

**Why Custom Errors are Better:**
| Old (require) | New (custom error) |
|---------------|-------------------|
| Stores string on blockchain | No string storage |
| Just says "Must be 18" | Shows actual values: `TooYoung(15, 18)` |
| More gas | Less gas |

**In this codebase** - All errors are defined in one file:
```solidity
// From contracts/error/Errors.sol
error Unauthorized(address msgSender, string role);
error SelfTransferNotSupported(address receiver);
error InvalidNativeTokenSender(address msgSender);
```

**Using them:**
```solidity
// From contracts/bank/Bank.sol:90-92
if (receiver == address(this)) {
    revert Errors.SelfTransferNotSupported(receiver);
}

// From contracts/role/RoleModule.sol
if (!roleStore.hasRole(msg.sender, role)) {
    revert Errors.Unauthorized(msg.sender, roleName);
}
```

### Legacy require() (Still Used Sometimes)
```solidity
require(amount > 0, "Amount must be positive");
require(msg.sender == owner, "Not authorized");
```

You'll still see `require()` in older code or simple checks, but this codebase prefers custom errors.

### Try-Catch for External Calls
```solidity
try externalContract.someFunction() returns (uint256 result) {
    // Success path
} catch Error(string memory reason) {
    // Catch revert with reason string
} catch (bytes memory lowLevelData) {
    // Catch low-level revert
}
```

---

## 14. Access Control Patterns

### What is Access Control?

Access control answers: **"Who can call this function?"**

Think of it like a building with different keycards - some people can access the lobby, others can access the server room, only admins can access everything.

### How This Codebase Does It

**Step 1: Define Roles**

**📍 See it in action:** [`contracts/role/Role.sol`](../contracts/role/Role.sol)
```solidity
// Each role is a unique bytes32 ID
bytes32 public constant CONTROLLER = keccak256(abi.encode("CONTROLLER"));
bytes32 public constant ORDER_KEEPER = keccak256(abi.encode("ORDER_KEEPER"));
```

**Step 2: Store Who Has Each Role**

**📍 See it in action:** [`contracts/role/RoleStore.sol`](../contracts/role/RoleStore.sol)
```solidity
// Check if someone has a role - super fast lookup
function hasRole(address account, bytes32 roleKey) public view returns (bool) {
    return roleCache[account][roleKey];
}
```

**Step 3: Create Modifiers That Check Roles**

**📍 See it in action:** [`contracts/role/RoleModule.sol`](../contracts/role/RoleModule.sol)
```solidity
modifier onlyController() {
    if (!roleStore.hasRole(msg.sender, Role.CONTROLLER)) {
        revert Errors.Unauthorized(msg.sender, "CONTROLLER");
    }
    _;
}
```

**Step 4: Use The Modifiers**

**📍 See it in action:** [`contracts/bank/Bank.sol`](../contracts/bank/Bank.sol)
```solidity
function transferOut(address token, address receiver, uint256 amount)
    external
    onlyController  // Only CONTROLLER role can call this!
{
    // ...
}
```

### Quick Summary

| Component | Purpose | File |
|-----------|---------|------|
| `Role.sol` | Defines role IDs | [`contracts/role/Role.sol`](../contracts/role/Role.sol) |
| `RoleStore.sol` | Tracks who has each role | [`contracts/role/RoleStore.sol`](../contracts/role/RoleStore.sol) |
| `RoleModule.sol` | Provides modifiers like `onlyController` | [`contracts/role/RoleModule.sol`](../contracts/role/RoleModule.sol) |

---

## 15. Reentrancy Guards

### What is Reentrancy?

**The Problem:** A contract sends you money BEFORE updating your balance. You can call back and get money again!

Think of it like an ATM that gives you cash before updating your account - you could keep pressing "withdraw" before it updates.

```solidity
// VULNERABLE contract - DO NOT USE
contract BadBank {
    mapping(address => uint256) public balances;

    function withdraw() external {
        uint256 amount = balances[msg.sender];

        // Step 1: Send money FIRST (DANGEROUS!)
        (bool success,) = msg.sender.call{value: amount}("");

        // Step 2: Update balance AFTER
        balances[msg.sender] = 0;  // Too late! Attacker already called again
    }
}
```

**The Attack:**
1. Attacker calls `withdraw()`
2. Bank sends ETH to attacker
3. Attacker's contract has a `receive()` function that calls `withdraw()` AGAIN
4. Bank hasn't updated balance yet, so it sends ETH again!
5. Repeat until bank is empty

**This is reentrancy** - calling back into the contract before it finishes.

### The Solution: Reentrancy Guard

A lock that prevents a function from being called while it's still running:

```solidity
contract SafeBank {
    bool private locked = false;  // The lock
    mapping(address => uint256) public balances;

    function withdraw() external {
        require(!locked, "No reentrancy!");  // Check lock
        locked = true;                        // Lock the door

        uint256 amount = balances[msg.sender];
        balances[msg.sender] = 0;             // Update FIRST (also helps!)

        (bool success,) = msg.sender.call{value: amount}("");

        locked = false;                       // Unlock
    }
}
```

Now if attacker tries to call `withdraw()` again during the first call, it fails because `locked == true`.

### OpenZeppelin's ReentrancyGuard (Easy Way)

```solidity
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract MyContract is ReentrancyGuard {
    function withdraw() external nonReentrant {  // Just add this modifier!
        // Safe from reentrancy
    }
}
```

The `nonReentrant` modifier does the lock/unlock for you.

### Global Reentrancy Guard (This Codebase)

This codebase has MANY contracts that interact. A regular lock only protects ONE contract.

**Solution:** Store the lock in DataStore so ALL contracts share it.

**📍 See it in action:** [`contracts/utils/GlobalReentrancyGuard.sol`](../contracts/utils/GlobalReentrancyGuard.sol)
```solidity
modifier globalNonReentrant() {
    // Check: is ANY contract in the protocol currently running?
    require(dataStore.getUint(LOCK_KEY) == 0, "Locked!");

    dataStore.setUint(LOCK_KEY, 1);  // Lock
    _;                                 // Run function
    dataStore.setUint(LOCK_KEY, 0);  // Unlock
}
```

**Why Global?** If Contract A calls Contract B, and B tries to call back to A (or any other protected contract), the global lock blocks it.

**📍 See it used:** [`contracts/exchange/OrderHandler.sol`](../contracts/exchange/OrderHandler.sol) - all order execution is protected

---

## 16. Assembly & Low-Level Calls

### What is Assembly?

Assembly is **raw EVM code** inside Solidity. It's like writing machine code instead of a high-level language.

**When you'll see it:** Gas-critical operations, or doing things Solidity can't do directly.

**Don't worry:** You don't need to write assembly to understand this codebase - just recognize it when you see it.

### Recognizing Assembly

When you see `assembly { ... }`, that's inline assembly:

**📍 See it in action:** [`contracts/token/TokenUtils.sol`](../contracts/token/TokenUtils.sol)
```solidity
assembly {
    success := call(gasLimit, receiver, amount, 0, 0, 0, 0)
}
```

This is doing a low-level ETH transfer for gas efficiency.

### Common Assembly You'll See

**📍 See it in action:** [`contracts/error/ErrorUtils.sol`](../contracts/error/ErrorUtils.sol)
```solidity
// Extract first 4 bytes of error data
assembly {
    errorSelector := mload(add(data, 0x20))
}
```

**📍 See it in action:** [`contracts/event/EventEmitter.sol`](../contracts/event/EventEmitter.sol)
```solidity
// Emit events efficiently
assembly {
    log2(add(data, 32), len, topic1, topic2)
}
```

### Quick Reference (If You're Curious)

| Operation | What it does |
|-----------|--------------|
| `mload(p)` | Read 32 bytes from memory |
| `mstore(p, v)` | Write 32 bytes to memory |
| `call(...)` | Call another contract |

**Bottom line:** If you see `assembly { }`, it's optimization. The surrounding Solidity code will tell you what it's trying to accomplish.

---

## 17. External Call Patterns

### SafeERC20 - Why We Need It

**The Problem:** Some tokens (like USDT) are broken - they don't follow the ERC20 standard properly.

**The Solution:** Use `safeTransfer` instead of `transfer`:

```solidity
// BAD - might fail with some tokens
IERC20(token).transfer(to, amount);

// GOOD - works with ALL tokens
IERC20(token).safeTransfer(to, amount);
```

**📍 See it in action:** [`contracts/router/Router.sol`](../contracts/router/Router.sol)
```solidity
using SafeERC20 for IERC20;  // Add safe methods to any token

function pluginTransfer(...) external {
    IERC20(token).safeTransferFrom(account, receiver, amount);
}
```

**Rule:** Always use `safeTransfer` when dealing with tokens you don't control.

### Multicall Pattern

Execute multiple function calls in one transaction:

**📍 See it in action:** [`contracts/utils/BasicMulticall.sol`](../contracts/utils/BasicMulticall.sol)
```solidity
function multicall(bytes[] calldata data) external returns (bytes[] memory results) {
    for (uint256 i; i < data.length; i++) {
        (bool success, bytes memory result) = address(this).delegatecall(data[i]);
        // ...
    }
}
```

**Why it's useful:** Instead of 5 separate transactions, do everything in 1.

### ABI Encoding (Brief Explanation)

When you see `abi.encodeWithSignature(...)`, it's converting a function call into raw bytes:

```solidity
// These are equivalent:
token.transfer(bob, 100);  // Direct call

// Encoded version (for low-level calls)
bytes memory data = abi.encodeWithSignature("transfer(address,uint256)", bob, 100);
(bool success,) = address(token).call(data);
```

**When you'll see this:** Multicall, timelock, and other advanced patterns.

**Don't worry about the details** - just know that `abi.encode...` is converting function calls to bytes.

---

## 18. Math & Type Casting

### SafeCast - Converting Between Number Types

**The Problem:** Solidity has signed (`int256`) and unsigned (`uint256`) numbers. Converting between them can overflow.

**The Solution:** SafeCast checks for overflow:

**📍 See it in action:** [`contracts/utils/Calc.sol`](../contracts/utils/Calc.sol)
```solidity
using SafeCast for uint256;
using SafeCast for int256;

uint256 unsigned = 100;
int256 signed = unsigned.toInt256();  // Safe! Checks for overflow
```

### Getting Absolute Values

```solidity
using SignedMath for int256;

int256 negative = -50;
int256 absolute = negative.abs();  // Returns 50
```

### Precision in DeFi

DeFi uses BIG numbers to avoid decimals. This codebase uses **30 decimal places**:

**📍 See it in action:** Throughout pricing calculations
```solidity
uint256 constant PRECISION = 1e30;  // 1 followed by 30 zeros

// $100 with 30 decimals = 100 * 1e30
uint256 priceUsd = 100 * PRECISION;
```

**Why 30 decimals?** Avoids rounding errors when doing math with small fractions.

**📍 Key file:** [`contracts/utils/Calc.sol`](../contracts/utils/Calc.sol) - math utilities

---

## 19. Key-Value Storage Pattern

### The Big Idea

Instead of each contract having its own storage, **one contract (DataStore) holds ALL data** for the entire protocol.

Think of it like a giant database that all contracts share.

### How It Works

**📍 See it in action:** [`contracts/data/DataStore.sol`](../contracts/data/DataStore.sol)
```solidity
contract DataStore {
    mapping(bytes32 => uint256) public uintValues;     // Store any number
    mapping(bytes32 => address) public addressValues;  // Store any address
    mapping(bytes32 => bool) public boolValues;        // Store any boolean
    // ... more types
}
```

**Reading and writing:**
```solidity
// Store a value
dataStore.setUint(someKey, 100);

// Read it back
uint256 value = dataStore.getUint(someKey);
```

### Keys Are Generated with keccak256

**📍 See it in action:** [`contracts/data/Keys.sol`](../contracts/data/Keys.sol)
```solidity
// Create unique keys by hashing strings
bytes32 public constant MAX_POOL_AMOUNT = keccak256(abi.encode("MAX_POOL_AMOUNT"));

// Combine with market address for market-specific values
bytes32 key = keccak256(abi.encode(MAX_POOL_AMOUNT, market, token));
```

### Why This Pattern?

| Benefit | Explanation |
|---------|-------------|
| Upgradability | Upgrade logic contracts without losing data |
| Flexibility | Add new data fields without new contracts |
| Sharing | Multiple contracts access the same data |

**📍 Key files:**
- [`contracts/data/DataStore.sol`](../contracts/data/DataStore.sol) - the database
- [`contracts/data/Keys.sol`](../contracts/data/Keys.sol) - all the key constants

---

## 20. DeFi-Specific Patterns

### Min/Max Prices

**📍 See it in action:** [`contracts/price/Price.sol`](../contracts/price/Price.sol)
```solidity
struct Props {
    uint256 min;  // Use for sells (worst case for seller)
    uint256 max;  // Use for buys (worst case for buyer)
}
```

**Why both?** Protects users from price manipulation. You always get the "fair" worst-case price.

### Market Structure

**📍 See it in action:** [`contracts/market/Market.sol`](../contracts/market/Market.sol)
```solidity
struct Props {
    address marketToken;   // LP token (what you get for providing liquidity)
    address indexToken;    // Price we track (e.g., ETH)
    address longToken;     // Pays long profits (e.g., WETH)
    address shortToken;    // Pays short profits (e.g., USDC)
}
```

### Order Types

**📍 See it in action:** [`contracts/order/Order.sol`](../contracts/order/Order.sol)

| Order Type | What It Does |
|------------|--------------|
| `MarketSwap` | Swap immediately at market price |
| `MarketIncrease` | Open/add to position now |
| `MarketDecrease` | Close/reduce position now |
| `LimitIncrease` | Open when price hits target |
| `LimitDecrease` | Take profit order |
| `StopLossDecrease` | Stop loss order |
| `Liquidation` | Forced closure (not enough collateral) |

### Fallback Transfers

**📍 See it in action:** [`contracts/token/TokenUtils.sol`](../contracts/token/TokenUtils.sol)

If a token transfer fails (e.g., receiver is a broken contract), tokens go to a "holding address" instead of being lost forever.

---

## 21. Common Naming Conventions

### Quick Reference

| Thing | Convention | Example |
|-------|------------|---------|
| Constants | `ALL_CAPS` | `MAX_POOL_AMOUNT` |
| Immutables | `camelCase` | `dataStore` |
| Internal functions | `_underscore` prefix | `_transferOut()` |
| Interface names | `I` prefix | `IERC20`, `IOrderHandler` |
| Struct fields | `camelCase` | `sizeInUsd` |

### Examples From This Codebase

**📍 Constants:** [`contracts/data/Keys.sol`](../contracts/data/Keys.sol)
```solidity
bytes32 public constant ACCOUNT = keccak256(abi.encode("ACCOUNT"));
```

**📍 Internal functions:** [`contracts/bank/Bank.sol`](../contracts/bank/Bank.sol)
```solidity
function _transferOut(...) internal { }
```

**📍 Struct naming:** [`contracts/order/Order.sol`](../contracts/order/Order.sol)
```solidity
struct Props {
    Addresses addresses;  // Sub-struct for address fields
    Numbers numbers;      // Sub-struct for number fields
    Flags flags;          // Sub-struct for boolean flags
}
```

---

## 22. Quick Reference Cheat Sheet

### Visibility - Who Can Call It?

| Keyword | Same Contract | Child Contract | Outside |
|---------|--------------|----------------|---------|
| `public` | ✅ | ✅ | ✅ |
| `external` | ❌ | ❌ | ✅ |
| `internal` | ✅ | ✅ | ❌ |
| `private` | ✅ | ❌ | ❌ |

### State Mutability - What Can It Do?

| Keyword | Read Blockchain | Change Blockchain |
|---------|----------------|-------------------|
| (none) | ✅ | ✅ |
| `view` | ✅ | ❌ |
| `pure` | ❌ | ❌ |

### Data Location - Where Is It Stored?

| Location | Lives Forever? | Cost | Can Change? |
|----------|---------------|------|-------------|
| `storage` | Yes | $$$ | Yes |
| `memory` | No (function only) | $$ | Yes |
| `calldata` | No (function only) | $ | No |

### Patterns You'll See Everywhere

| When You See... | It Means... |
|-----------------|-------------|
| `using SafeCast for uint256` | Added safe conversion methods to uint256 |
| `modifier onlyController` | Check that runs before function |
| `revert Errors.Something()` | Stop and return an error |
| `emit EventName()` | Log something for off-chain apps |
| `interface IERC20` | Promise of what functions exist |
| `abstract contract Base` | Template that can't be deployed alone |
| `immutable dataStore` | Set once in constructor, never changes |

### 📍 Key Files to Explore

| Start Here | To Learn About |
|------------|----------------|
| [`contracts/data/DataStore.sol`](../contracts/data/DataStore.sol) | Key-value storage pattern |
| [`contracts/role/RoleModule.sol`](../contracts/role/RoleModule.sol) | Access control & modifiers |
| [`contracts/order/Order.sol`](../contracts/order/Order.sol) | Structs & libraries |
| [`contracts/bank/Bank.sol`](../contracts/bank/Bank.sol) | Inheritance |
| [`contracts/error/Errors.sol`](../contracts/error/Errors.sol) | Custom errors |
