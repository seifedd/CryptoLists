'use strict';

/////////////////////////////////////////////////
/////////////////////////////////////////////////
// BANKIST APP

// Data
const account1 = {
  owner: 'Seth Seifeddine Mejri',
  movements: [0.02, 0.0045, -0.04, 0.3, -0.065, -0.013, 0.0007, 0.13],
  interestRate: 1.2, // %
  pin: 1111
};

const account2 = {
  owner: 'Jessica Davis',
  movements: [0.0005, 0.34, -0.015, -0.079, -0.321, -0.1, 0.85, -0.003],
  interestRate: 1.5,
  pin: 2222
};

const account3 = {
  owner: 'Steven Thomas Williams',
  movements: [0.02, -0.02, 0.034, -0.03, -0.02, 0.005, 0.04, -0.046],
  interestRate: 0.7,
  pin: 3333
};

const account4 = {
  owner: 'Sarah Smith',
  movements: [0.043, 0.1, 0.7, 0.005, 0.009],
  interestRate: 1,
  pin: 4444
};

const accounts = [account1, account2, account3, account4];

// Elements
const labelWelcome = document.querySelector('.welcome');
const labelDate = document.querySelector('.date');
const labelBalance = document.querySelector('.balance__value');
const labelSumIn = document.querySelector('.summary__value--in');
const labelSumOut = document.querySelector('.summary__value--out');
const labelSumInterest = document.querySelector('.summary__value--interest');
const labelTimer = document.querySelector('.timer');

const containerApp = document.querySelector('.app');
const containerMovements = document.querySelector('.movements');

const btnLogin = document.querySelector('.login__btn');
const btnTransfer = document.querySelector('.form__btn--transfer');
const btnLoan = document.querySelector('.form__btn--loan');
const btnClose = document.querySelector('.form__btn--close');
const btnSort = document.querySelector('.btn--sort');

const inputLoginUsername = document.querySelector('.login__input--user');
const inputLoginPin = document.querySelector('.login__input--pin');
const inputTransferTo = document.querySelector('.form__input--to');
const inputTransferAmount = document.querySelector('.form__input--amount');
const inputLoanAmount = document.querySelector('.form__input--loan-amount');
const inputCloseUsername = document.querySelector('.form__input--user');
const inputClosePin = document.querySelector('.form__input--pin');
const DrpDownBtn = document.querySelector('.dropdown');

//Display the account movements
const displayMovements = function(movements) {
  containerMovements.innerHTML = '';
  movements.forEach((mov, i) => {
    const type = mov > 0 ? 'deposit' : 'withdrawal';
    const html = `        
    <div class="movements__row">
    <div class="movements__type movements__type--${type}">${i + 1} ${type}</div>
    <div class="movements__value">${mov}</div>
  </div>`;
    containerMovements.insertAdjacentHTML('afterbegin', html);
  });
};

//Calculate the Accoutn Balance
const calcDisplayBalance = function(acc) {
  const balance = acc.movements.reduce((acc, mov) => acc + mov, 0);
  acc.balance = balance.toFixed(12);
  labelBalance.textContent = `${balance}BTC`;
};

//Display the Summary for In, Out, and Interest
const DisplaySummary = function(acc) {
  const deposits = acc.movements.filter(function(mov) {
    return mov > 0;
  });
  labelSumIn.textContent = deposits
    .reduce((acc, mov) => mov + acc, 0)
    .toFixed(4);
  const whithrawals = acc.movements.filter(function(mov) {
    return mov < 0;
  });
  labelSumOut.textContent = Math.abs(
    whithrawals.reduce((acc, mov) => acc + mov, 0)
  ).toFixed(4);

  labelSumInterest.textContent = acc.interestRate.toFixed(4);
};

const createUsernames = function(acct) {
  acct.forEach(function(acc) {
    acc.username = acc.owner
      .toLowerCase()
      .split(' ')
      .map(function(name) {
        return name[0];
      })
      .join('');
  });
  return acct;
};
createUsernames(accounts);

const updateUI = function(acc) {
  displayMovements(acc.movements);
  calcDisplayBalance(acc);
  DisplaySummary(acc);
};

let currentAccount;
//console.log(account1.movements);
btnLogin.addEventListener('click', function(e) {
  e.preventDefault();
  //accounts.find(acc => acc.username == inputLoginUsername.value);
  currentAccount = accounts.find(
    acc => acc.username === inputLoginUsername.value
  );
  if (currentAccount.pin === Number(inputLoginPin.value)) {
    labelWelcome.textContent = `Welcome back, ${
      currentAccount.owner.split(' ')[0]
    }`;
    containerApp.style.opacity = 100;
    DrpDownBtn.style.opacity = 100;

    //display movements
    displayMovements(currentAccount.movements);

    //display balance
    calcDisplayBalance(currentAccount);

    //display summary
    DisplaySummary(currentAccount);
  }
});

btnTransfer.addEventListener('click', function(e) {
  e.preventDefault();
  const amount = Number(inputTransferAmount.value);
  const receiveAcc = accounts.find(
    acc => acc.username === inputTransferTo.value
  );

  inputTransferAmount.value = inputTransferTo.value = '';

  if (
    amount > 0 &&
    receiveAcc &&
    currentAccount.balance >= amount &&
    receiveAcc.username !== currentAccount.username
  ) {
    currentAccount.movements.push(-amount);
    receiveAcc.movements.push(+amount);
    updateUI(currentAccount);
  }
});

//Implement the Request A Loan

btnLoan.addEventListener('click', function(e) {
  e.preventDefault();
  const amount = inputLoanAmount.value;
  if (
    amount > 0 &&
    currentAccount.movements.some(mov => mov >= amount * 0.01)
  ) {
    currentAccount.movements.push(amount);

    //Update the UI
    updateUI(currentAccount);
  }
  inputLoanAmount.value = '';
});

//Implement Close Account
btnClose.addEventListener('click', function(e) {
  e.preventDefault();

  if (
    inputCloseUsername.value === currentAccount.username &&
    Number(inputClosePin.value) == currentAccount.pin
  ) {
    const index = accounts.findIndex(
      acc => acc.username === currentAccount.username
    );
    console.log(index);

    //delete account
    accounts.splice(index, 1);

    //Hide UI
    containerApp.style.opacity = 0;
  } else {
    console.log('Account not found!');
  }
  inputCloseUsername.value = inputClosePin.value = '';
});

// const arr = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
// //console.log(arr.flat());

// const arrDeep = [[[1, 2], 3], 4, [[5], 5, 6], 7];
// //console.log(arrDeep.flat(3));

// const allMovements = accounts.map(function(acc) {
//   return acc.movements;
// });

// //all the movements
// console.log(allMovements);
// const All_sum = allMovements.flat(2).reduce(function(mov, accu) {
//   return mov + accu;
// });

// console.log(All_sum);

// console.log(
//   accounts
//     .map(acc => acc.movements)
//     .flat(2)
//     .reduce((acc, mov) => acc + mov, 0)
// );

const arr_Elements = [200, 450, -400, 3000, -650, -130, 70, 1300];
console.log(arr_Elements);
console.log(arr_Elements.sort((a, b) => -1));
