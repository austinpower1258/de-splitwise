const provider = new ethers.providers.JsonRpcProvider("http://localhost:8545");
var defaultAccount;
// Constant we use later
var GENESIS = '0x0000000000000000000000000000000000000000000000000000000000000000';

// This is the ABI for your contract (get it from Remix, in the 'Compile' tab)
// ============================================================
var abi = [
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "_creditor",
				"type": "address"
			},
			{
				"internalType": "int32",
				"name": "_amount",
				"type": "int32"
			}
		],
		"name": "add_IOU",
		"outputs": [
			{
				"internalType": "bool",
				"name": "res",
				"type": "bool"
			}
		],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getLedger",
		"outputs": [
			{
				"components": [
					{
						"components": [
							{
								"internalType": "address",
								"name": "creditor",
								"type": "address"
							},
							{
								"internalType": "int32",
								"name": "amount",
								"type": "int32"
							},
							{
								"internalType": "uint256",
								"name": "creditor_id",
								"type": "uint256"
							},
							{
								"internalType": "bool",
								"name": "valid",
								"type": "bool"
							}
						],
						"internalType": "struct Splitwise.IOU[]",
						"name": "IOUs",
						"type": "tuple[]"
					},
					{
						"internalType": "address",
						"name": "debtor",
						"type": "address"
					},
					{
						"internalType": "uint256",
						"name": "id",
						"type": "uint256"
					},
					{
						"internalType": "bool",
						"name": "valid",
						"type": "bool"
					}
				],
				"internalType": "struct Splitwise.Debtor[]",
				"name": "_ledgerArr",
				"type": "tuple[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "debtor",
				"type": "address"
			},
			{
				"internalType": "address",
				"name": "creditor",
				"type": "address"
			}
		],
		"name": "lookup",
		"outputs": [
			{
				"internalType": "int32",
				"name": "ret",
				"type": "int32"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
]; // FIXME: fill this in with your contract's ABI //Be sure to only have one array, not two

// ============================================================
abiDecoder.addABI(abi);
// call abiDecoder.decodeMethod to use this - see 'getAllFunctionCalls' for more

var contractAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3"; // FIXME: fill this in with your contract's address/hash
var BlockchainSplitwise = new ethers.Contract(contractAddress, abi, provider.getSigner(defaultAccount));

// =============================================================================
//                            Functions To Implement
// =============================================================================

async function getLedger() { 
	return BlockchainSplitwise.getLedger()
}

async function getNeighbors(node)	{ 
	let ledgerArr = await getLedger();
	var index = 0
	var debtorBool = false;
	var neighbors = [];

	for (var i = 0; i < ledgerArr.length; i++)	{
		if (ledgerArr[i]["debtor"].toLowerCase() == node.toLowerCase())	{
			index = i;
			debtorBool = true;
			break;
		}
	}

	if (debtorBool)	{
		for (var j = 0; j < ledgerArr[index]["IOUs"].length; j++)	{ 
			if (ledgerArr[index]["IOUs"][j]["valid"]) {
				neighbors.push({"creditor": ledgerArr[index]["IOUs"][j]["creditor"], "amount": ledgerArr[index]["IOUs"][j]["amount"]});
			}	
		}
	} 
	return neighbors;
}

async function getUsers() {
	let ledgerArr = await getLedger();
	var usersSet = new Set();

	for (var i = 0; i < ledgerArr.length; i++){
		usersSet.add(ledgerArr[i].debtor)
		
		for (var j = 0; j < ledgerArr[i].IOUs.length; j++)	{ 
			usersSet.add(ledgerArr[i]["IOUs"][j]["creditor"]);
		}
	}

	return Array.from(usersSet);
}

async function getTotalOwed(user) {
	let neighbors = await getNeighbors(user);
	var amount_owed = 0;

	for (var i = 0; i < neighbors.length; i++)	{
		amount_owed += parseInt(neighbors[i]["amount"], 10);
	}

	return amount_owed;
}

async function getLastActive(user) {
	var currentBlock = await provider.getBlockNumber();
	final_timestamp = null;

	while (currentBlock !== GENESIS) {
	  var block = await provider.getBlockWithTransactions(currentBlock, true);
	  var timestamp = block.timestamp;
	  var trxns = block.transactions;
	  
	  if (trxns != null) {
			for (var j = 0; j < trxns.length; j++) {
				var trxn = trxns[j];

				if (trxn.to && trxn.to.toLowerCase() === user.toLowerCase() || trxn.from && trxn.from.toLowerCase() === user.toLowerCase() ) {
					if (final_timestamp == null || timestamp > final_timestamp) {
						final_timestamp = timestamp;
					}
						
				}
			}
		  currentBlock = block.parentHash;
	  }
	}

	return final_timestamp;
}

async function add_IOU(creditor, amount) {
	var path = await doBFS(creditor, defaultAccount, getNeighbors);
	amount = parseInt(amount, 10);

	var response = false;

	if (path){
		let { l, minimumOwed } = path;
		minimumAmount = Math.min(parseInt(minimumOwed, 10), amount);

		for (var i = 0; i < l.length; i++)	{
			if (l[i]["amount"] - minimumAmount < 0)	{
				return;
			}
		}

		for (var i = 0; i < l.length - 1; i++){
			response = await BlockchainSplitwise.connect(provider.getSigner(l[i]["creditor"])).add_IOU(l[i + 1]["creditor"], -minimumAmount);
		}
		
		response = await BlockchainSplitwise.connect(provider.getSigner(defaultAccount)).add_IOU(creditor, amount - minimumAmount);

	} else {
		response = await BlockchainSplitwise.connect(provider.getSigner(defaultAccount)).add_IOU(creditor, amount);
	}
}

// ====================================
// 				Testing					
// ====================================
// Test your code during dev

// =============================================================================
//                              Provided Functions
// =============================================================================
// Reading and understanding these should help you implement the above

// This searches the block history for all calls to 'functionName' (string) on the 'addressOfContract' (string) contract
// It returns an array of objects, one for each call, containing the sender ('from'), arguments ('args'), and the timestamp ('t')
async function getAllFunctionCalls(addressOfContract, functionName) {
	var curBlock = await provider.getBlockNumber();
	var function_calls = [];

	while (curBlock !== GENESIS) {
	  var b = await provider.getBlock(curBlock, true);
	  var txns = b.transactions;
	  for (var j = 0; j < txns.length; j++) {
	  	var txn = txns[j];

	  	// check that destination of txn is our contract
			if(txn.to == null){continue;}
	  	if (txn.to.toLowerCase() === addressOfContract.toLowerCase()) {
	  		var func_call = abiDecoder.decodeMethod(txn.input);

				// check that the function getting called in this txn is 'functionName'
				if (func_call && func_call.name === functionName) {
					var time = await provider.getBlock(curBlock);
	  			var args = func_call.params.map(function (x) {return x.value});
	  			function_calls.push({
	  				from: txn.from.toLowerCase(),
	  				args: args,
						t: time.timestamp
	  			})
	  		}
	  	}
	  }
	  curBlock = b.parentHash;
	}
	return function_calls;
}


// We've provided a breadth-first search implementation for you, if that's useful
// It will find a path from start to end (or return null if none exists)
// You just need to pass in a function ('getNeighbors') that takes a node (string) and returns its adj_nodes (as an array)
async function doBFS(start, end, getNeighbors) {
	var q = [[{"creditor": start, "amount": Number.MAX_SAFE_INTEGER}]]; 
	var minimumAmount = Number.MAX_SAFE_INTEGER;

	while (q.length > 0) {
		var current = q.shift();
		var finalNode = current[current.length - 1];

		if (finalNode["creditor"] === end) {
			for (var i = 0; i < current.length; i++) {
				if (parseInt(current[i]["amount"], 10) < parseInt(minimumAmount, 10))
					minimumAmount = current[i]["amount"];
			}

			return {"l": current, "minimumOwed": minimumAmount};
			
		} else {
			var neighbors = await getNeighbors(finalNode["creditor"]);

			for (var i = 0; i < neighbors.length; i++) {
				q.push(current.concat([neighbors[i]]));
			}
		}
	}
	return null;
}

// =============================================================================
//                                      UI
// =============================================================================

// This sets the default account on load and displays the total owed to that
// account.

provider.listAccounts().then((response)=> {
	defaultAccount = response[0];

	getTotalOwed(defaultAccount).then((response)=>{
		$("#total_owed").html("$"+response);
	});

	getLastActive(defaultAccount).then((response)=>{
		time = timeConverter(response)
		$("#last_active").html(time)
	});
});

// This code updates the 'My Account' UI with the results of your functions
$("#myaccount").change(function() {
	defaultAccount = $(this).val();

	getTotalOwed(defaultAccount).then((response)=>{
		$("#total_owed").html("$"+response);
	})

	getLastActive(defaultAccount).then((response)=>{
		time = timeConverter(response)
		$("#last_active").html(time)
	});
});

// Allows switching between accounts in 'My Account' and the 'fast-copy' in 'Address of person you owe
provider.listAccounts().then((response)=>{
	var opts = response.map(function (a) { return '<option value="'+
			a.toLowerCase()+'">'+a.toLowerCase()+'</option>' });
	$(".account").html(opts);
	$(".wallet_addresses").html(response.map(function (a) { return '<li>'+a.toLowerCase()+'</li>' }));
});

// This code updates the 'Users' list in the UI with the results of your function
getUsers().then((response)=>{
	$("#all_users").html(response.map(function (u,i) { return "<li>"+u+"</li>" }));
});

// This runs the 'add_IOU' function when you click the button
// It passes the values from the two inputs above
$("#addiou").click(function() {
	defaultAccount = $("#myaccount").val(); //sets the default account
  add_IOU($("#creditor").val(), $("#amount").val()).then((response)=>{
		window.location.reload(false); // refreshes the page after add_IOU returns and the promise is unwrapped
	})
});

// This is a log function, provided if you want to display things to the page instead of the JavaScript console
// Pass in a discription of what you're printing, and then the object to print
function log(description, obj) {
	$("#log").html($("#log").html() + description + ": " + JSON.stringify(obj, null, 2) + "\n\n");
}


// =============================================================================
//                                      TESTING
// =============================================================================

// This section contains a sanity check test that you can use to ensure your code
// works. We will be testing your code this way, so make sure you at least pass
// the given test. You are encouraged to write more tests!

// Remember: the tests will assume that each of the four client functions are
// async functions and thus will return a promise. Make sure you understand what this means.

function check(name, condition) {
	if (condition) {
		console.log(name + ": SUCCESS");
		return 3;
	} else {
		console.log(name + ": FAILED");
		return 0;
	}
}

async function sanityCheck() {
	console.log ("\nTEST", "Simplest possible test: only runs one add_IOU; uses all client functions: lookup, getTotalOwed, getUsers, getLastActive");

	var score = 0;

	var accounts = await provider.listAccounts();
	defaultAccount = accounts[0];

	var users = await getUsers();
	score += check("getUsers() initially empty", users.length === 0);

	var owed = await getTotalOwed(accounts[1]);
	score += check("getTotalOwed(0) initially empty", owed === 0);

	var lookup_0_1 = await BlockchainSplitwise.lookup(accounts[0], accounts[1]);
	console.log("lookup(0, 1) current value" + lookup_0_1);
	score += check("lookup(0,1) initially 0", parseInt(lookup_0_1, 10) === 0);

	var response = await add_IOU(accounts[1], "10");

	users = await getUsers();
	score += check("getUsers() now length 2", users.length === 2);

	owed = await getTotalOwed(accounts[0]);
	score += check("getTotalOwed(0) now 10", owed === 10);

	lookup_0_1 = await BlockchainSplitwise.lookup(accounts[0], accounts[1]);
	score += check("lookup(0,1) now 10", parseInt(lookup_0_1, 10) === 10);

	var timeLastActive = await getLastActive(accounts[0]);
	var timeNow = Date.now()/1000;
	var difference = timeNow - timeLastActive;
	score += check("getLastActive(0) works", difference <= 60 && difference >= -3); // -3 to 60 seconds

	defaultAccount = accounts[1];
	var response = await add_IOU(accounts[0], "10");

	console.log("Final Score: " + score +"/21");
}

// sanityCheck();
