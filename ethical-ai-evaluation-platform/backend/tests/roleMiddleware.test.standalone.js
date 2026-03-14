/**
 * Role Middleware Test (Standalone)
 * Refactored for lightweight runner compatibility
 */

// Simulated Middleware
function requireAdmin(req, res, next) {
    if (!req.user) {
        return res.status(401).json({ message: "Unauthorized" });
    }
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: "Forbidden: Admins only" });
    }
    next();
}

describe('Role-Based Authorization (Middleware)', () => {

    test('should allow admin user to access protected route', () => {
        let nextCalled = false;
        let statusCalled = false;

        const mockReq = { user: { id: 1, role: 'admin' } };
        const mockRes = {
            status: (code) => { statusCalled = true; return mockRes; }, // Chainable
            json: () => { }
        };
        const mockNext = () => { nextCalled = true; };

        requireAdmin(mockReq, mockRes, mockNext);

        expect(nextCalled).toBe(true);
        expect(statusCalled).toBe(false);
    });

    test('should block non-admin user (Expert)', () => {
        let nextCalled = false;
        let statusCode = 0;
        let jsonPayload = null;

        const mockReq = { user: { id: 2, role: 'medical-expert' } };
        const mockRes = {
            status: (code) => { statusCode = code; return mockRes; },
            json: (data) => { jsonPayload = data; }
        };
        const mockNext = () => { nextCalled = true; };

        requireAdmin(mockReq, mockRes, mockNext);

        expect(nextCalled).toBe(false);
        expect(statusCode).toBe(403);
        expect(jsonPayload.message).toBe("Forbidden: Admins only");
    });

    test('should deny access if no user logged in', () => {
        let statusCode = 0;
        let jsonPayload = null;

        const mockReq = { user: null };
        const mockRes = {
            status: (code) => { statusCode = code; return mockRes; },
            json: (data) => { jsonPayload = data; }
        };
        const mockNext = () => { };

        requireAdmin(mockReq, mockRes, mockNext);

        expect(statusCode).toBe(401);
        expect(jsonPayload.message).toBe("Unauthorized");
    });
});
