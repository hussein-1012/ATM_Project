using AqrabMakinaLeek.Application.Common.Interfaces;
using Isopoh.Cryptography.Argon2;

namespace AqrabMakinaLeek.Infrastructure.Security;

public class Argon2PasswordHasher : IPasswordHasher
{
    public string Hash(string password)
    {
        return Argon2.Hash(password);
    }

    public bool Verify(string passwordHash, string password)
    {
        try
        {
            return Argon2.Verify(passwordHash, password);
        }
        catch
        {
            return false;
        }
    }
}
