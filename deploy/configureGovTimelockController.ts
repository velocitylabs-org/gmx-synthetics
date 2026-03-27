import { TIMELOCK_ADMIN_ROLE, PROPOSER_ROLE, EXECUTOR_ROLE, CANCELLER_ROLE } from "../utils/gov";

const func = async ({ getNamedAccounts }) => {
  const { deployer } = await getNamedAccounts();

  const govTimelockController = await ethers.getContract("GovTimelockController");
  const protocolGovernor = await ethers.getContract("ProtocolGovernor");

  if (!(await govTimelockController.hasRole(TIMELOCK_ADMIN_ROLE, deployer))) {
    console.info("skipping govTimelockController role config, as deployer does not have access to update roles");
    return;
  }

  if (!(await govTimelockController.hasRole(PROPOSER_ROLE, protocolGovernor.address))) {
    console.log("Granting PROPOSER_ROLE to ProtocolGovernor...");
    const tx = await govTimelockController.grantRole(PROPOSER_ROLE, protocolGovernor.address);
    await tx.wait();
  } else {
    console.log("ProtocolGovernor already has PROPOSER_ROLE, skipping");
  }

  if (!(await govTimelockController.hasRole(CANCELLER_ROLE, protocolGovernor.address))) {
    console.log("Granting CANCELLER_ROLE to ProtocolGovernor...");
    const tx = await govTimelockController.grantRole(CANCELLER_ROLE, protocolGovernor.address);
    await tx.wait();
  } else {
    console.log("ProtocolGovernor already has CANCELLER_ROLE, skipping");
  }

  if (!(await govTimelockController.hasRole(EXECUTOR_ROLE, protocolGovernor.address))) {
    console.log("Granting EXECUTOR_ROLE to ProtocolGovernor...");
    const tx = await govTimelockController.grantRole(EXECUTOR_ROLE, protocolGovernor.address);
    await tx.wait();
  } else {
    console.log("ProtocolGovernor already has EXECUTOR_ROLE, skipping");
  }

  console.log("Revoking TIMELOCK_ADMIN_ROLE from deployer...");
  const tx = await govTimelockController.revokeRole(TIMELOCK_ADMIN_ROLE, deployer);
  await tx.wait();
};

func.dependencies = ["GovTimelockController", "ProtocolGovernor"];
func.tags = ["ConfigureGovTimelockController"];

export default func;
