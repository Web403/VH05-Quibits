import { Router } from 'express';
import { asyncHandler } from '../../common/async-handler.js';
import { authenticate, authorize } from '../../middleware/authenticate.js';
import { qrResolveRateLimiter } from '../../middleware/rate-limit.js';
import * as controller from './machines.controller.js';

export function machineRoutes(): Router {
  const router = Router();
  const base = '/machines';

  router.use(base, authenticate());

  router.get(base, authorize('machine.read'), asyncHandler(controller.list));
  // Static segment BEFORE `/:id`, or "resolve-qr" would be parsed as an id.
  // The QR value identifies a machine; it never authorizes access by itself.
  router.get(
    `${base}/resolve-qr/:qrValue`,
    qrResolveRateLimiter(),
    authorize('machine.read'),
    asyncHandler(controller.resolveQr),
  );
  router.get(`${base}/:id`, authorize('machine.read'), asyncHandler(controller.getById));
  router.post(base, authorize('machine.create'), asyncHandler(controller.create));
  router.patch(`${base}/:id`, authorize('machine.update'), asyncHandler(controller.update));
  router.delete(`${base}/:id`, authorize('machine.delete'), asyncHandler(controller.remove));

  return router;
}
