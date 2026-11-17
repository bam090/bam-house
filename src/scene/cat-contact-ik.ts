import { MathUtils, Quaternion, Vector3 } from 'three'
import type { Object3D } from 'three'

type Limb = { front: boolean; jointNames: string[]; jointRests: number[][] }

// Blending joint rotations alone makes planted paws arc through the floor.
// Blend the exported contact goals, then solve each rigid bone chain around those goals.
export function createCatContactIK(model: Object3D) {
  const rig = model.getObjectByName('Snowdrop')
  if (rig?.userData.skinning !== 'dualQuaternion') return () => {}
  const legs = (rig.userData.gait.legs as Limb[]).map((l, i) => ({
    ...l, bones: l.jointNames.map(n => model.getObjectByName(n)!), rests: l.jointRests.map(p => new Vector3(...p)),
    wrist: model.getObjectByName(`CatGoal_${i}_end`)!, paw: model.getObjectByName(`CatGoal_${i}_foot`)!,
  }))
  const local = (o: Object3D) => rig.worldToLocal(o.getWorldPosition(new Vector3()))
  function rotate(bone: Object3D, rotation: Quaternion) {
    const world = rig!.getWorldQuaternion(new Quaternion()).multiply(rotation)
    bone.quaternion.copy(bone.parent!.getWorldQuaternion(new Quaternion()).invert().multiply(world))
    rig!.updateMatrixWorld(true)
  }
  function aim(bone: Object3D, restDirection: Vector3, target: Vector3) {
    rotate(bone, new Quaternion().setFromUnitVectors(restDirection.normalize(), target.clone().sub(local(bone)).normalize()))
  }
  return () => {
    model.updateMatrixWorld(true)
    for (const leg of legs) {
      const [upper, lower, end, foot] = leg.bones, [a, b, c, d] = leg.rests
      const hip = local(upper), wrist = local(leg.wrist), paw = local(leg.paw), axis = wrist.clone().sub(hip)
      const l1 = a.distanceTo(b), l2 = b.distanceTo(c), raw = axis.length(), distance = MathUtils.clamp(raw, Math.abs(l1 - l2) + 1e-5, l1 + l2 - 1e-5)
      axis.normalize()
      const along = (l1 * l1 - l2 * l2 + distance * distance) / (2 * distance)
      const pole = new Vector3(0, 0, leg.front ? -1 : 1); pole.addScaledVector(axis, -pole.dot(axis)).normalize()
      const knee = hip.clone().addScaledVector(axis, along).addScaledVector(pole, Math.sqrt(Math.max(0, l1 * l1 - along * along)))
      aim(upper, b.clone().sub(a), knee); aim(lower, c.clone().sub(b), wrist); aim(end, d.clone().sub(c), paw); rotate(foot, new Quaternion())
    }
  }
}
