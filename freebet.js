var solanaWeb3 = require("@solana/web3.js");
var token = require("@solana/spl-token");
var bs58 = require("bs58");

var programID = new solanaWeb3.PublicKey("9uReBEtnYGYf1oUe4KGSt6kQhsqGE74i17NzRNEDLutn");
var pool = new solanaWeb3.PublicKey("3SdgUSptYW5NM4SFUYfJwV3awTG7hYJnc1T1yL519mEZ");
var tokenProgram = new solanaWeb3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
var mint = new solanaWeb3.PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");
var connection = new solanaWeb3.Connection("https://api.devnet.solana.com");
var burner = solanaWeb3.Keypair.fromSecretKey(new Uint8Array([33, 2, 27, 57, 123, 10, 206, 228, 205, 65, 217, 174, 205, 73, 187, 239, 28, 155, 245, 64, 235, 186, 149, 174, 16, 123, 162, 33, 164, 168, 76, 19, 150, 33, 165, 201, 131, 31, 183, 88, 154, 249, 6, 48, 254, 127, 127, 103, 142, 248, 150, 170, 79, 1, 21, 41, 238, 134, 53, 215, 8, 247, 190, 153]));
var freeBettor = solanaWeb3.Keypair.fromSecretKey(bs58.decode("43XJK81QeR6kdew3W8mYKZDDBzJHe6TGzuDU5v5ZypwUQEUyKyKschmdapKNyAj96HjemKKJG6WwrmXraMmHo6Mp"));            
var freeBetTokenAssocTok = new solanaWeb3.PublicKey("2zFPYxNRGVDCFVCWKZnRBDPJgVNnHwUraMFVRD2HTx7j");
var freeBetDestination = new solanaWeb3.PublicKey("DBCnqBshPoJAo7vCidZ5mwtAi2ctEQphFSLftekEpUgb");
var freeBetMint = new solanaWeb3.PublicKey("CD7pSsX2RzwQpefKzUADyogzSiLkM6thDMzWRusEdteT");

function numToBytes(num, bytes){
    let output = [0, 0, 0, 0, 0, 0, 0, 0];
    for(let pow = 7; pow >= 0; pow--){
        output[pow] = Math.floor(num / 256**pow);
        num = num % 256**pow;
    }
    return output.slice(0, bytes);
}

function instrData(){
    let data = [];
    let ids = [
        {name: "sport", bytes: 1}, 
        {name: "league", bytes: 4}, 
        {name: "event", bytes: 8},
        {name: "period", bytes: 1},
        {name: "mkt", bytes: 2}
    ];
    for(let i = 0; i < ids.length; i++){
        let value = 2;
        data = data.concat(numToBytes(value, ids[i].bytes));
    }
    data = data.concat([0, 0, 0, 0]);
    let stake0, stake1;
    let userStake = 16;
    let odds = 3;
    let side = 0;
    if(side == 0){
        stake0 = numToBytes(userStake * 1000000);
        stake1 = numToBytes(userStake * (odds - 1) * 1000000);
    }
    else{
        stake0 = numToBytes(userStake * (odds - 1) * 1000000);
        stake1 = numToBytes(userStake * 1000000);
    }
    data = data.concat(stake0).concat(stake1);
    data.push(parseInt(side));
    return data;
}
async function genTx(payer, tokAuth){
    //add an instruction to transfer free bet tokens from freeBettor to payer
    let tokInstr = token.createTransferInstruction(freeBetTokenAssocTok, freeBetDestination, freeBettor.publicKey, 16000000);

    let rentExemptVal = 1000000000 * 0.00187224;
    let seed = 'purebet' + Math.random() * 1000000000000;
    let newAcc = await solanaWeb3.PublicKey.createWithSeed(payer, seed, programID);
    let instr = solanaWeb3.SystemProgram.createAccountWithSeed({
        fromPubkey: payer,
        basePubkey: payer,
        seed: seed,
        newAccountPubkey: newAcc,
        lamports: rentExemptVal,
        space: 141,
        programId: programID,
    });
                
            
    let callForATA = await connection.getTokenAccountsByOwner(tokAuth, { mint: mint });
    let source = callForATA.value[0].pubkey;
                
    let betInstr = new solanaWeb3.TransactionInstruction({
        keys: [
            {pubkey: newAcc, isSigner: false, isWritable: true },
            {pubkey: tokenProgram, isSigner: false, isWritable: false},
            {pubkey: source, isSigner: false, isWritable: true },
            {pubkey: pool, isSigner: false, isWritable: true},
            {pubkey: tokAuth, isSigner: true, isWritable: true },
            {pubkey: freeBettor.publicKey, isSigner: true, isWritable: true },
            {pubkey: payer, isSigner: true, isWritable: true },
        ],
        programId: programID,
        data: new Uint8Array(instrData()),
    });
                
    let transaction = new solanaWeb3.Transaction();
    transaction.add(tokInstr);
    transaction.add(instr);
    transaction.add(betInstr);
    transaction.feePayer = payer;
    let blockInfo = await connection.getLatestBlockhash(); 
    transaction.recentBlockhash = blockInfo.blockhash;
    return transaction;
}

async function call(){
    let tx = await genTx(burner.publicKey, burner.publicKey);
    let sig = await solanaWeb3.sendAndConfirmTransaction(connection, tx, [burner, freeBettor]);
    console.log(sig);
}

call();
//note for building this tx on the frontend
// accs go source (writable), destination (writable), authority (writable + signer)
//instr data is 03 for the first byte, and then u64 lil end of transfer amount (times a million for usdc) for rest of bytes
