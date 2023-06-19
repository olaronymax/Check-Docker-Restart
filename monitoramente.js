const axios = require('axios');
const { Client } = require('ssh2');
const fs = require('fs');

// URL para verificar
const url = 'https://API.com';

// Configurações SSH
const sshConfig = {
  host: 'IP',
  port: 22,
  username: '',
  privateKey: fs.readFileSync('/chave.pem')
};

// Função para reiniciar o Docker no servidor SSH
function restartDockerOnSSH() {
  const conn = new Client();

  conn.on('ready', () => {
    conn.exec('sudo docker restart backend', (err, stream) => {
      if (err) throw err;

      stream.on('close', (code, signal) => {
        console.log('Docker reiniciado com sucesso no servidor SSH.');
        conn.end();
      }).stderr.on('data', (data) => {
        console.error(`STDERR: ${data}`);
      });
    });
  }).connect(sshConfig);
}

// Função para analisar as estatísticas de uso de memória
function analyzeMemoryUsage(memoryUsage) {
  // Separa o uso de memória em duas partes: quantidade e unidade (por exemplo, "1.5 GiB")
  const [amount, unit] = memoryUsage.split(' ');

  // Remove o sufixo da unidade para obter apenas o valor numérico
  const numericAmount = parseFloat(amount);

  // Converte todas as unidades para bytes para facilitar a comparação
  const bytes = {
    KiB: numericAmount * 1024,
    MiB: numericAmount * 1024 * 1024,
    GiB: numericAmount * 1024 * 1024 * 1024,
    TiB: numericAmount * 1024 * 1024 * 1024 * 1024
  }[unit];

  // Verifica se o uso de memória excede um limite específico (por exemplo, 1 GiB)
  const memoryLimit = 1 * 1024 * 1024 * 1024; // Limite de 1 GiB
  if (bytes > memoryLimit) {
    console.log('Alerta de heap de memória excedido!');
    console.log(`Uso de memória atual: ${memoryUsage}`);
    console.log('Tomando ação necessária...');
    // Aqui você pode adicionar lógica adicional para lidar com o problema de heap de memória, como reiniciar
    // o contêiner, otimizar o código, etc.
  } else {
    console.log('Uso de memória dentro do limite.');
  }
}

// Função para verificar a URL e reiniciar o Docker se houver erro
function checkURLAndRestartDocker() {
  axios.head(url)
    .then(response => {
      const currentTime = new Date().toLocaleTimeString(); // Obtém a hora atual

      console.log(`Cabeçalho da URL verificado com sucesso às ${currentTime}.`);
    })
    .catch(error => {
      if (error.response && error.response.status === 504) {
        console.error('Erro ao verificar o cabeçalho da URL:', error.message);
        console.log('Conectando ao servidor SSH e reiniciando o Docker...');
        restartDockerOnSSH();
      }
    });
}

// Função para executar o comando "docker stats" no servidor SSH e obter as estatísticas de uso de memória
function getDockerStats() {
  const conn = new Client();

  conn.on('ready', () => {
    conn.exec('docker stats --format "{{.Container}}\t{{.MemUsage}}"', (err, stream) => {
      if (err) throw err;

      let data = '';

      stream.on('data', (chunk) => {
        data += chunk.toString();
      });

      stream.on('close', (code, signal) => {
        analyzeDockerStats(data);
        conn.end();
      });

      stream.stderr.on('data', (data) => {
        console.error(`Erro ao obter estatísticas do Docker: ${data}`);
      });
    });
  }).connect(sshConfig);
}

// Função para analisar as estatísticas de uso de memória do Docker
function analyzeDockerStats(data) {
  const stats = data.trim().split('\n');

  stats.forEach(stat => {
    const [container, memUsage] = stat.split('\t');
    console.log(`Contêiner: ${container}`);
    console.log(`Uso de memória: ${memUsage}`);
    analyzeMemoryUsage(memUsage);
    console.log('-----------------------------------');
  });
}

// Executa a verificação da URL, reinicia o Docker se necessário e inicia a verificação do heap de memória
setInterval(checkURLAndRestartDocker, 30 * 1000);

setInterval(getDockerStats, 30 * 1000);

// Executa a verificação da URL e reinicia o Docker a cada 30 segundos
setInterval(checkURLAndRestartDocker, 30 * 1000);
