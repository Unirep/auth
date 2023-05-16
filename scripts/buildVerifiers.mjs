import fs from 'fs/promises'
import path from 'path'
import url from 'url'
import { circuitContents } from './circuits.mjs'

import hardhat from 'hardhat'
import hardhatConfig from '../hardhat.config.cjs'

const __dirname = path.dirname(url.fileURLToPath(import.meta.url))

const verifiersPath = hardhatConfig?.paths?.sources
  ? path.join(hardhatConfig.paths.sources, 'verifiers')
  : path.join(hardhat.config.paths.sources, 'verifiers')

const zkFilesPath = path.join(__dirname, '../zksnarkBuild')

// create verifier folder
try {
  await fs.mkdir(verifiersPath, { recursive: true })
} catch (e) {
  console.log('Cannot create folder ', e)
}

for (const circuit of Object.keys(circuitContents)) {
  const verifierName = createVerifierName(circuit)
  const solOut = path.join(verifiersPath, `${verifierName}.sol`)
  const vkeyData = await fs.readFile(
    path.join(zkFilesPath, `${circuit}.vkey.json`)
  )
  const vKey = JSON.parse(vkeyData.toString())

  console.log(`Exporting ${circuit} verification contract...`)
  const verifier = genVerifier(verifierName, vKey)

  await fs.writeFile(solOut, verifier)
  await fs.copyFile(solOut, path.join(verifiersPath, `${verifierName}.sol`))
}

function createVerifierName(circuit) {
  return `${circuit.charAt(0).toUpperCase() + circuit.slice(1)}Verifier`
}

function genVerifier(contractName, vk) {
  let template = groth16Verifier()

  template = template.replace('<%contract_name%>', contractName)

  const vkalpha1 =
    `uint256(${vk.vk_alpha_1[0].toString()}),` +
    `uint256(${vk.vk_alpha_1[1].toString()})`
  template = template.replace('<%vk_alpha1%>', vkalpha1)

  const vkbeta2 =
    `[uint256(${vk.vk_beta_2[0][1].toString()}),` +
    `uint256(${vk.vk_beta_2[0][0].toString()})], ` +
    `[uint256(${vk.vk_beta_2[1][1].toString()}),` +
    `uint256(${vk.vk_beta_2[1][0].toString()})]`
  template = template.replace('<%vk_beta2%>', vkbeta2)

  const vkgamma2 =
    `[uint256(${vk.vk_gamma_2[0][1].toString()}),` +
    `uint256(${vk.vk_gamma_2[0][0].toString()})], ` +
    `[uint256(${vk.vk_gamma_2[1][1].toString()}),` +
    `uint256(${vk.vk_gamma_2[1][0].toString()})]`
  template = template.replace('<%vk_gamma2%>', vkgamma2)

  const vkdelta2 =
    `[uint256(${vk.vk_delta_2[0][1].toString()}),` +
    `uint256(${vk.vk_delta_2[0][0].toString()})], ` +
    `[uint256(${vk.vk_delta_2[1][1].toString()}),` +
    `uint256(${vk.vk_delta_2[1][0].toString()})]`
  template = template.replace('<%vk_delta2%>', vkdelta2)

  template = template.replace(
    '<%vk_input_length%>',
    (vk.IC.length - 1).toString()
  )
  template = template.replace('<%vk_ic_length%>', vk.IC.length.toString())
  let vi = ''
  for (let i = 0; i < vk.IC.length; i++) {
    if (vi.length !== 0) {
      vi = vi + '        '
    }
    vi =
      vi +
      `vk.IC[${i}] = Pairing.G1Point(uint256(${vk.IC[i][0].toString()}),` +
      `uint256(${vk.IC[i][1].toString()}));\n`
  }
  template = template.replace('<%vk_ic_pts%>', vi)

  return template
}

function groth16Verifier() {
  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

library Pairing {
    uint256 constant PRIME_Q =
        21888242871839275222246405745257275088696311157297823662689037894645226208583;

    struct G1Point {
        uint256 X;
        uint256 Y;
    }

    // Encoding of field elements is: X[0] * z + X[1]
    struct G2Point {
        uint256[2] X;
        uint256[2] Y;
    }

    /*
     * @return The negation of p, i.e. p.plus(p.negate()) should be zero.
     */
    function negate(G1Point memory p) internal pure returns (G1Point memory) {
        // The prime q in the base field F_q for G1
        if (p.X == 0 && p.Y == 0) {
            return G1Point(0, 0);
        } else {
            return G1Point(p.X, PRIME_Q - (p.Y % PRIME_Q));
        }
    }

    /*
     * @return The sum of two points of G1
     */
    function plus(G1Point memory p1, G1Point memory p2)
        internal
        view
        returns (G1Point memory r)
    {
        uint256[4] memory input;
        input[0] = p1.X;
        input[1] = p1.Y;
        input[2] = p2.X;
        input[3] = p2.Y;
        bool success;

        // solium-disable-next-line security/no-inline-assembly
        assembly {
            success := staticcall(sub(gas(), 2000), 6, input, 0xc0, r, 0x60)
            // Use "invalid" to make gas estimation work
            switch success
            case 0 {
                invalid()
            }
        }

        require(success, 'pairing-add-failed');
    }

    /*
     * @return The product of a point on G1 and a scalar, i.e.
     *         p == p.scalar_mul(1) and p.plus(p) == p.scalar_mul(2) for all
     *         points p.
     */
    function scalar_mul(G1Point memory p, uint256 s)
        internal
        view
        returns (G1Point memory r)
    {
        uint256[3] memory input;
        input[0] = p.X;
        input[1] = p.Y;
        input[2] = s;
        bool success;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            success := staticcall(sub(gas(), 2000), 7, input, 0x80, r, 0x60)
            // Use "invalid" to make gas estimation work
            switch success
            case 0 {
                invalid()
            }
        }
        require(success, 'pairing-mul-failed');
    }

    /* @return The result of computing the pairing check
     *         e(p1[0], p2[0]) *  .... * e(p1[n], p2[n]) == 1
     *         For example,
     *         pairing([P1(), P1().negate()], [P2(), P2()]) should return true.
     */
    function pairing(
        G1Point memory a1,
        G2Point memory a2,
        G1Point memory b1,
        G2Point memory b2,
        G1Point memory c1,
        G2Point memory c2,
        G1Point memory d1,
        G2Point memory d2
    ) internal view returns (bool) {
        G1Point[4] memory p1 = [a1, b1, c1, d1];
        G2Point[4] memory p2 = [a2, b2, c2, d2];

        uint256 inputSize = 24;
        uint256[] memory input = new uint256[](inputSize);

        for (uint256 i = 0; i < 4; i++) {
            uint256 j = i * 6;
            input[j + 0] = p1[i].X;
            input[j + 1] = p1[i].Y;
            input[j + 2] = p2[i].X[0];
            input[j + 3] = p2[i].X[1];
            input[j + 4] = p2[i].Y[0];
            input[j + 5] = p2[i].Y[1];
        }

        uint256[1] memory out;
        bool success;

        // solium-disable-next-line security/no-inline-assembly
        assembly {
            success := staticcall(
                sub(gas(), 2000),
                8,
                add(input, 0x20),
                mul(inputSize, 0x20),
                out,
                0x20
            )
            // Use "invalid" to make gas estimation work
            switch success
            case 0 {
                invalid()
            }
        }

        require(success, 'pairing-opcode-failed');

        return out[0] != 0;
    }
}

contract <%contract_name%> {

    using Pairing for *;

    uint256 constant SNARK_SCALAR_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint256 constant PRIME_Q = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    struct VerifyingKey {
        Pairing.G1Point alpha1;
        Pairing.G2Point beta2;
        Pairing.G2Point gamma2;
        Pairing.G2Point delta2;
        Pairing.G1Point[<%vk_ic_length%>] IC;
    }

    struct Proof {
        Pairing.G1Point A;
        Pairing.G2Point B;
        Pairing.G1Point C;
    }

    function verifyingKey() internal pure returns (VerifyingKey memory vk) {
        vk.alpha1 = Pairing.G1Point(<%vk_alpha1%>);
        vk.beta2 = Pairing.G2Point(<%vk_beta2%>);
        vk.gamma2 = Pairing.G2Point(<%vk_gamma2%>);
        vk.delta2 = Pairing.G2Point(<%vk_delta2%>);
        <%vk_ic_pts%>
    }

    /*
     * @returns Whether the proof is valid given the hardcoded verifying key
     *          above and the public inputs
     */
    function verifyProof(
        uint256[] calldata input,
        uint256[8] calldata _proof
    ) public view returns (bool) {

        Proof memory proof;
        proof.A = Pairing.G1Point(_proof[0], _proof[1]);
        proof.B = Pairing.G2Point([_proof[2], _proof[3]], [_proof[4], _proof[5]]);
        proof.C = Pairing.G1Point(_proof[6], _proof[7]);

        VerifyingKey memory vk = verifyingKey();

        // Compute the linear combination vk_x
        Pairing.G1Point memory vk_x = Pairing.G1Point(0, 0);

        // Make sure that proof.A, B, and C are each less than the prime q
        require(proof.A.X < PRIME_Q, "verifier-aX-gte-prime-q");
        require(proof.A.Y < PRIME_Q, "verifier-aY-gte-prime-q");

        require(proof.B.X[0] < PRIME_Q, "verifier-bX0-gte-prime-q");
        require(proof.B.Y[0] < PRIME_Q, "verifier-bY0-gte-prime-q");

        require(proof.B.X[1] < PRIME_Q, "verifier-bX1-gte-prime-q");
        require(proof.B.Y[1] < PRIME_Q, "verifier-bY1-gte-prime-q");

        require(proof.C.X < PRIME_Q, "verifier-cX-gte-prime-q");
        require(proof.C.Y < PRIME_Q, "verifier-cY-gte-prime-q");

        // Make sure that every input is less than the snark scalar field
        //for (uint256 i = 0; i < input.length; i++) {
        for (uint256 i = 0; i < <%vk_input_length%>; i++) {
            require(input[i] < SNARK_SCALAR_FIELD,"verifier-gte-snark-scalar-field");
            vk_x = Pairing.plus(vk_x, Pairing.scalar_mul(vk.IC[i + 1], input[i]));
        }

        vk_x = Pairing.plus(vk_x, vk.IC[0]);

        return Pairing.pairing(
            Pairing.negate(proof.A),
            proof.B,
            vk.alpha1,
            vk.beta2,
            vk_x,
            vk.gamma2,
            proof.C,
            vk.delta2
        );
    }
}
`
}
