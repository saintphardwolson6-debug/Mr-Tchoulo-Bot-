const { Client, GatewayIntentBits } = require('discord.js');
const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState } = require('@whiskeysockets/baileys');
const pino = require('pino');

// 1. Configuration du Bot Discord
const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 2. Sekirite: Yo pran Token an nan variables d'environnement kounye a
// Ou dwe konfigirasyon "DISCORD_TOKEN" sou Render oswa Railway
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;

if (!DISCORD_TOKEN) {
    console.error("❌ Erreur : DISCORD_TOKEN pa jwenn nan variables d'environnement yo!");
    process.exit(1);
}

discordClient.once('ready', () => {
    console.log(`Bot Discord connecté avec succès : ${discordClient.user.tag}`);
});

// 3. Écoute des messages sur le serveur Discord
discordClient.on('messageCreate', async (message) => {
    // On ignore les messages des autres bots
    if (message.author.bot) return;

    // Détection de la commande !pair
    if (message.content.startsWith('!pair')) {
        const args = message.content.split(' ');
        let numero = args[1];

        if (!numero) {
            return message.reply('❌ Veuillez entrer un numéro après la commande. Exemple : `!pair 50931234567` (sans le signe +)');
        }

        // Nettoyage du numéro (on garde uniquement les chiffres)
        numero = numero.replace(/[^0-9]/g, '');

        const messageAttente = await message.reply('⏳ Génération du code de liaison WhatsApp en cours, veuillez patienter...');

        try {
            // Initialisation d'une session temporaire pour ce numéro
            const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${numero}`);
            
            const sock = makeWASocket({
                auth: state,
                logger: pino({ level: 'silent' }),
                browser: ['Chrome (Linux)', '', ''] 
            });

            // Si le numéro n'est pas déjà enregistré, on demande le code d'association
            if (!sock.authState.creds.registered) {
                // Petite pause de sécurité pour initialiser le système
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // Demande du code de liaison à 8 caractères auprès des serveurs WhatsApp
                const codeLiaison = await sock.requestPairingCode(numero);
                
                // Formatage visuel du code (Exemple: ABCD-EFGH)
                const codeFormate = codeLiaison.match(/.{1,4}/g).join('-');

                await messageAttente.edit(`✅ **Code de connexion WhatsApp généré :**\n# \`${codeFormate}\`\n\n*Comment l'utiliser :*\n1. Ouvrez WhatsApp sur votre téléphone.\n2. Allez dans **Paramètres > Appareils connectés**.\n3. Appuyez sur **Connecter un appareil**.\n4. Choisissez **Se connecter avec le numéro de téléphone plutôt** (en bas de l'écran).\n5. Entrez ce code à 8 caractères.`);
            } else {
                await messageAttente.edit('⚠️ Ce numéro est déjà connecté au bot !');
            }

            // Sauvegarde automatique des identifiants de connexion
            sock.ev.on('creds.update', saveCreds);

        } catch (error) {
            console.error(error);
            await messageAttente.edit('❌ Une erreur est survenue lors de la génération du code. Vérifiez que le numéro contient bien l\'indicatif du pays (ex: 33..., 509...).');
        }
    }
});

// Lancement du bot Discord
discordClient.login(DISCORD_TOKEN);
