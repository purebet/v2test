const programID = new solanaWeb3.PublicKey("9uReBEtnYGYf1oUe4KGSt6kQhsqGE74i17NzRNEDLutn");
const tokenProgram = new solanaWeb3.PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const pool = new solanaWeb3.PublicKey("3SdgUSptYW5NM4SFUYfJwV3awTG7hYJnc1T1yL519mEZ");
const pda = new solanaWeb3.PublicKey("8AbwG4Cbr9DefgeF7P9Pt9RJMA1RS1KVogRWBWh9U8wM");

let mint = new solanaWeb3.PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");
let connection = new solanaWeb3.Connection("https://api.devnet.solana.com");

const cluster = {
    devnet: {
        connection: new solanaWeb3.Connection('https://api.devnet.solana.com'),
        mint: new solanaWeb3.PublicKey('Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr')
    },
    mainnet: {
        connection: new solanaWeb3.Connection('https://thrumming-burned-bush.solana-mainnet.quiknode.pro/5bb1fc012c796f46f7249e3ec7b3e62ed563f846/'),
        mint: new solanaWeb3.PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v')
    }
};


window.changeCluster = function() {
    const selection = cluster[this.value];
    mint = selection.mint;
    connection = selection.connection;
};

window.solana.on("connect", () => {
    document.getElementById("addr").innerHTML = window.solana.publicKey.toBase58();
});

window.refund = async () => {
    const pubkey = document.getElementById("acc").value;
    const keyform = new solanaWeb3.PublicKey(pubkey);
    const info = await connection.getAccountInfo(keyform);    
    const betData = Array.from(info.data);
    const side = isEmpty(betData.slice(36, 68)) ? 1 : 0;
    const betInstr = await getRefundInstruction(betData, side, keyform, true);
    const transaction = new solanaWeb3.Transaction();
    const blockInfo = await connection.getLatestBlockhash();

    transaction.add(betInstr);
    transaction.recentBlockhash = blockInfo.blockhash;
    transaction.feePayer = window.solana.publicKey;

    const signature = await sendRefundTransaction(transaction);
    document.getElementById("sig1").setAttribute("href", "https://explorer.solana.com/tx/" + signature + "?cluster=devnet");
    document.getElementById("sig1").innerHTML = signature;
};


window.refundAll = async () => {
    /*
    BET ACCOUNT DATA STRUCTURE *********************

    pub struct BetAcc {            offset   size
        pub sport: u8,                0      1
        pub league: u32,              1      4
        pub event: u64,               5      8
        pub period: u8,              13      1
        pub mkt: u16,                14      2
        pub player: u32,             16      4
        pub stake0: u64,             20      8
        pub stake1: u64,             28      8
        pub wallet0: [u8; 32],       36     32
        pub wallet1: [u8; 32],       68     32
        pub rent_payer: [u8; 32],   100     32
        pub is_free_bet: bool,      132      1
        pub placed_at: u64,         133      8
        pub to_aggregate: bool,     141      1
    }

    */
    // const eventID = 184076394n;
    const eventID = BigInt(document.getElementById('eventID').value);
    const memcmp = {
        bytes: Base58.encode(new Uint8Array(new BigUint64Array([eventID]).buffer)),
        offset: 5
    };
    const res = await connection.getProgramAccounts(programID, { filters: [{memcmp}] });
    const ixPromises = [];

    for (const {account, pubkey} of res) {
        const betData = Array.from(account.data);
        let side = 0;

        if (isEmpty(betData.slice(36, 68))) side = 1;
        else if (isEmpty(betData.slice(68, 100))) {}
        else continue;

        ixPromises.push(getRefundInstruction(betData, side, pubkey));
    }

    document.getElementById('betCount').textContent = `Found ${ixPromises.length} bets to refund`;

    if (ixPromises.length === 0) return;

    const ixList = await Promise.all(ixPromises);
    const blockInfo = await connection.getLatestBlockhash();
    const signatures = [];
    const sizeLimit = 1000;

    while (ixList.length) {
        const tx = new solanaWeb3.Transaction();
        tx.recentBlockhash = blockInfo.blockhash;        
        tx.feePayer = window.solana.publicKey;

        while (ixList.length) {
            tx.add(ixList.pop());
            const buff = tx.serialize({ requireAllSignatures: false, verifySignatures: false });

            if (buff.length >= sizeLimit) {
                ixList.push(tx.instructions.pop());
                break;
            }
        }

        signatures.push(sendRefundTransaction(tx));
    }

    console.log(await Promise.all(signatures));
};

async function getRefundInstruction(betData, side, keyform, shouldPrint) {
    let id = betData.slice(0, 20);
    let instrData = id.concat([side, 1]);    
    let solTo = new solanaWeb3.PublicKey(betData.slice(100, 132));
    let addrStart = 100;

    if (betData[132] == 0) {
        addrStart = side == 0 ? 36 : 68;
    }
    
    let tokenTo = new solanaWeb3.PublicKey(betData.slice(addrStart, addrStart + 32));

    if (shouldPrint) {
        document.getElementById("rentTo").innerHTML = solTo.toBase58();
        document.getElementById("tokTo").innerHTML = tokenTo.toBase58();
    }
    
    let callForATA = await connection.getTokenAccountsByOwner(tokenTo, { mint: mint });
    let destination = callForATA.value[0].pubkey;
    
    let call = new XMLHttpRequest();
    let url = "https://p43l0w1hu4.execute-api.ap-northeast-1.amazonaws.com/default/pendingBetsV2?cancel=" + keyform.toBase58() + "&for=" + tokenTo.toBase58();
    call.open("GET", url, false);
    call.send();
    if(call.status >= 400){
        alert(call.responseText);
        return;
    }
    return new solanaWeb3.TransactionInstruction({
        keys: [
            {pubkey: keyform, isSigner: false, isWritable: true },
            {pubkey: tokenProgram, isSigner: false, isWritable: false},
            {pubkey: pool, isSigner: false, isWritable: true },
            {pubkey: destination, isSigner: false, isWritable: true},
            {pubkey: window.solana.publicKey, isSigner: true, isWritable: true },
            {pubkey: solTo, isSigner: false, isWritable: true },
            {pubkey: pda, isSigner: false, isWritable: true }
        ],
        programId: programID,
        data: new Uint8Array(instrData),
    });
}

async function sendRefundTransaction(transaction) {
    let signed = await window.solana.signTransaction(transaction);
    let signature = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(signature);
    return signature;
}


function isEmpty(arr) {
    for (const val of arr) {
        if (val) return false;
    }

    return true;
}
