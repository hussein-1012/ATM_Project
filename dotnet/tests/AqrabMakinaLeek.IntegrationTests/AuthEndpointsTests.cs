using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using AqrabMakinaLeek.Application.DTOs;
using Xunit;

namespace AqrabMakinaLeek.IntegrationTests;

public class AuthEndpointsTests : IClassFixture<CustomWebApplicationFactory>
{
    private readonly HttpClient _client;

    public AuthEndpointsTests(CustomWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task Register_And_Login_Flow_WorksCorrectly()
    {
        var email = $"test_{Guid.NewGuid():N}@example.com";
        var password = "SecurePassword123!";

        // 1. Register (Name, Email, Password) -> Returns UserResponseDto
        var registerReq = new RegisterRequest("Ahmed Ali", email, password);
        var regResponse = await _client.PostAsJsonAsync("/v1/auth/register", registerReq);

        Assert.Equal(HttpStatusCode.Created, regResponse.StatusCode);
        var regContent = await regResponse.Content.ReadAsStringAsync();
        using var regDoc = JsonDocument.Parse(regContent);
        Assert.Equal(email, regDoc.RootElement.GetProperty("user").GetProperty("email").GetString());
        Assert.Equal("Ahmed Ali", regDoc.RootElement.GetProperty("user").GetProperty("name").GetString());

        // 2. Register Duplicate Email -> 409 Conflict with EMAIL_TAKEN
        var dupResponse = await _client.PostAsJsonAsync("/v1/auth/register", registerReq);
        Assert.Equal(HttpStatusCode.Conflict, dupResponse.StatusCode);
        var errContent = await dupResponse.Content.ReadAsStringAsync();
        using var errDoc = JsonDocument.Parse(errContent);
        Assert.Equal("EMAIL_TAKEN", errDoc.RootElement.GetProperty("code").GetString());

        // 3. Login with Wrong Password -> 401
        var wrongLogin = await _client.PostAsJsonAsync("/v1/auth/login", new LoginRequest(email, "WrongPassword!"));
        Assert.Equal(HttpStatusCode.Unauthorized, wrongLogin.StatusCode);

        // 4. Login with Correct Password -> 200 OK with tokens
        var loginResponse = await _client.PostAsJsonAsync("/v1/auth/login", new LoginRequest(email, password));
        Assert.Equal(HttpStatusCode.OK, loginResponse.StatusCode);
        var loginAuth = await loginResponse.Content.ReadFromJsonAsync<AuthResponseDto>();
        Assert.NotNull(loginAuth);
        Assert.False(string.IsNullOrEmpty(loginAuth.AccessToken));
        Assert.False(string.IsNullOrEmpty(loginAuth.RefreshToken));
        Assert.Equal(email, loginAuth.User.Email);

        // 5. Get Profile /v1/me without token -> 401
        var unauthMe = await _client.GetAsync("/v1/me");
        Assert.Equal(HttpStatusCode.Unauthorized, unauthMe.StatusCode);

        // 6. Get Profile /v1/me with Bearer token -> 200
        using var authedReq = new HttpRequestMessage(HttpMethod.Get, "/v1/me");
        authedReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", loginAuth.AccessToken);
        var meResponse = await _client.SendAsync(authedReq);
        Assert.Equal(HttpStatusCode.OK, meResponse.StatusCode);
        var userDto = await meResponse.Content.ReadFromJsonAsync<UserResponseDto>();
        Assert.NotNull(userDto);
        Assert.Equal(email, userDto.Email);

        // 7. Update Profile /v1/me -> 200
        using var updateReq = new HttpRequestMessage(HttpMethod.Patch, "/v1/me");
        updateReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", loginAuth.AccessToken);
        updateReq.Content = JsonContent.Create(new UpdateProfileDto(Name: "Ahmed Mohamed Ali"));
        var updateResponse = await _client.SendAsync(updateReq);
        Assert.Equal(HttpStatusCode.OK, updateResponse.StatusCode);
        var updatedUser = await updateResponse.Content.ReadFromJsonAsync<UserResponseDto>();
        Assert.NotNull(updatedUser);
        Assert.Equal("Ahmed Mohamed Ali", updatedUser.Name);

        // 8. Change Password /v1/me/change-password -> 200
        using var changePassReq = new HttpRequestMessage(HttpMethod.Post, "/v1/me/change-password");
        changePassReq.Headers.Authorization = new AuthenticationHeaderValue("Bearer", loginAuth.AccessToken);
        changePassReq.Content = JsonContent.Create(new ChangePasswordRequest(password, "NewSecurePassword456!"));
        var changePassResponse = await _client.SendAsync(changePassReq);
        Assert.Equal(HttpStatusCode.OK, changePassResponse.StatusCode);

        // 9. Logout -> 200
        var logoutResponse = await _client.PostAsJsonAsync("/v1/auth/logout", new RefreshTokenRequest(loginAuth.RefreshToken));
        Assert.Equal(HttpStatusCode.OK, logoutResponse.StatusCode);
    }
}
