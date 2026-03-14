/**
 * User Registration Test (Standalone with Mock DB)
 * Refactored for lightweight runner compatibility
 */

// Simulated Service/Model
const mockUserDB = [];
const registerUser = async (userData) => {
    if (!userData.email) throw new Error("Email validation failed: Required");
    if (!userData.password || userData.password.length < 6) throw new Error("Password validation failed: Min 6 chars");

    // Simulate Unique Check
    const exists = mockUserDB.find(u => u.email === userData.email);
    if (exists) throw new Error("Email already registered");

    const newUser = { id: Date.now(), ...userData };
    mockUserDB.push(newUser);
    return newUser;
};

describe('User Registration (Mock DB)', () => {

    test('should successfully register a valid user', async () => {
        mockUserDB.length = 0; // Reset
        const validUser = {
            name: "Test User",
            email: "test@example.com",
            password: "securePassword123",
            role: "expert"
        };

        const result = await registerUser(validUser);

        // Manual property check
        expect(result.id !== undefined).toBe(true);
        expect(result.email).toBe(validUser.email);
        expect(mockUserDB.length).toBe(1);
    });

    test('should fail when email is missing', async () => {
        mockUserDB.length = 0;
        const invalidUser = {
            name: "No Email",
            password: "password123"
        };

        try {
            await registerUser(invalidUser);
            expect("Should have thrown error").toBe("but did not"); // Fail test
        } catch (e) {
            expect(e.message).toBe("Email validation failed: Required");
        }
    });

    test('should prevent duplicate email registration', async () => {
        mockUserDB.length = 0;
        const user1 = { email: "duplicate@test.com", password: "123456" };
        await registerUser(user1);

        const user2 = { email: "duplicate@test.com", password: "987654" };

        try {
            await registerUser(user2);
            expect("Should have thrown error").toBe("but did not"); // Fail test
        } catch (e) {
            expect(e.message).toBe("Email already registered");
        }
    });
});
